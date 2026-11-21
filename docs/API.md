# Tali receiver API (v0.4)

The phone app talks to the receiver (ESP32) over plain HTTP + JSON on the receiver's Wi-Fi.
The simulator in `js/engine.js` and `js/transport.js` implements exactly this contract, so the
app works the same with the real board once the firmware matches it.

## Connecting

| Item | Value |
| --- | --- |
| Receiver Wi-Fi (AP mode) | SSID `Tali-XXXX` (last 4 hex of MAC), WPA2 |
| Base URL | `http://192.168.4.1` |
| Recommended | Serve `app.html`, `css/`, `js/` from the receiver's LittleFS so the app is same-origin. Then leave **Receiver address** empty in Settings. |
| CORS | If the app is hosted elsewhere, answer every route (including `OPTIONS` preflight) with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`. |
| HTTPS | Browsers block `http://` calls from an `https://` page. Use the receiver-hosted page for demos. |

The app polls `GET /api/status` every **700 ms**. If no good response arrives for **2.5 s** it shows
**Stale**; after **7 s** it shows **Receiver offline**, and every item reads as *Unknown*, never "safe".
(PRD acceptance: "If the dashboard loses its link, it marks its own status offline.")

---

## `GET /api/status`

```json
{
  "receiver": "Tali Band",
  "fw": "tali-rx 0.4.0",
  "uptime_ms": 183422,
  "battery_pct": 86,
  "motion": "moving",
  "list": { "id": "site", "name": "Site visit", "rev": 7 },
  "config": { "confirm_ms": 3000, "drop_ms": 1500, "heard_rssi": -80 },
  "items": [
    { "tag_id": "tag-wallet", "name": "Wallet", "state": "check",
      "rssi": -91, "last_heard_ms": 6120, "battery_pct": 82, "ringing": false }
  ],
  "events": [
    { "id": 41, "t": 182900, "type": "alert", "tag_id": "tag-wallet", "name": "Wallet",
      "msg": "Check Wallet: left behind as you moved", "state": "check" }
  ]
}
```

| Field | Notes |
| --- | --- |
| `uptime_ms` | Must reset to ~0 on reboot. The app uses a drop in uptime to detect a restart and resets its event cursor. |
| `motion` | `"moving"` or `"still"`, from the motion sensor. Demo boards without IMU: always `"moving"`. |
| `list` | The list currently stored in flash. The app shows **Saved** only when `id` and `rev` match what it sent. |
| `items[].state` | `waiting`, `nearby`, `rechecking`, `away`, `check`, `recovered` (see the state machine below). |
| `items[].rssi` | Smoothed dBm, or `null` if no advert in the last 3 s. |
| `items[].last_heard_ms` | Time since the last advert at or above `heard_rssi`; `null` if never heard this session. |
| `events` | The last ~30 events (ring buffer). `id` increases monotonically per boot. The app shows each event once. Types: `armed`, `state`, `alert`, `recovered`, `suppressed`, `list`, `ring`, `reboot`. |

## `POST /api/carry`: save today's carry list

Request:
```json
{ "id": "site", "name": "Site visit", "rev": 8,
  "tags": [ { "tag_id": "tag-wallet", "name": "Wallet", "kind": "tag" },
            { "tag_id": "phone-1", "name": "Phone", "kind": "phone" } ] }
```
Response **after it is written to flash** (Preferences/NVS):
```json
{ "ack": true, "rev": 8 }
```
Any other response, or no response, makes the app show **Not saved**. On boot the receiver reloads this list
and every item starts in `waiting`; it arms only after it has seen each item.

## `POST /api/ring`: toggle ringing on or off

```json
{ "tag_id": "tag-wallet", "on": true, "max_ms": 60000 }
```
→ `{ "ringing": true }`, or HTTP 409 `{ "error": "not reachable" }` if the tag has not been heard in the last 2 s.

- `on: true` makes the receiver connect to the tag and write `0xFF` (ring continuously) to the ring characteristic. It **keeps the
  connection open** while ringing, so the tag's presence keeps updating from connection RSSI even if the tag pauses advertising.
- `on: false` writes `0x00` (stop), **disconnects**, and resumes scanning. Stopping a tag that is not ringing still returns 200.
- Safety: the receiver auto-stops after `max_ms` (default 60 s) to protect the tag battery, then reports `ringing: false` in `/api/status`.
- The app shows **Stop ringing** whenever `items[].ringing` is true.
- While ringing, ignore missing adverts (no false "rechecking") until 1.5 s after the ring stops.

## `GET /api/scan`

Unpaired Tali tags currently advertising, strongest first:
```json
{ "tags": [ { "tag_id": "tag-4f2a", "rssi": -48, "kind": "tag" } ] }
```

## `POST /api/config`

```json
{ "confirm_ms": 3000, "heard_rssi": -80 }
```
→ `{ "ok": true }`. Persist in NVS. `confirm_ms` ∈ {0, 3000, 5000} in the app.

---

## Bluetooth (tags)

| | UUID |
| --- | --- |
| Tali service (advertised) | `7a1e0001-5a1f-4c3b-9d1e-7a11b0000001` |
| Ring characteristic (write 1 byte: `0xFF` ring until stopped, `0x00` stop) | `7a1e0002-5a1f-4c3b-9d1e-7a11b0000001` |
| Battery | Standard Battery Service `0x180F`, or byte 0 of manufacturer data |

Tags advertise every **200–300 ms** with the service UUID and a stable `tag_id` in manufacturer data.
The receiver filters scan results by the service UUID.

## Alert state machine (per item)

The firmware should port `ReceiverLogic.prototype.tick` in `js/engine.js` line for line. Defaults:

| Constant | Default | Meaning |
| --- | --- | --- |
| `dropMs` | 1500 | No strong advert for this long → `rechecking` |
| `confirmMs` | 3000 | Item must stay missing this long *after the wearer starts moving* |
| `aroundDepartureMs` | 3000 | Item must have been heard within this window of the departure to alert |
| `recoverPackets` / `recoverWindowMs` | 3 / 2500 | Consistent readings needed to recover or re-arm |
| `recoveredHoldMs` | 8000 | How long `recovered` shows before returning to `nearby` |
| `heardRssi` | -80 dBm | Weaker adverts count as "not heard" |

```
waiting ──first strong advert──▶ nearby
nearby ──no advert for dropMs──▶ rechecking
rechecking ──≥2 adverts again──▶ nearby                     (brief interruption, quiet)
rechecking ──wearer still, missing > confirm+1s──▶ away     (loan rule, quiet)
rechecking ──wearer moving, item seen around departure,
             missing ≥ confirmMs since max(loss, move start)──▶ check   (ONE vibration)
rechecking ──wearer moving but item already gone before──▶ away
away ──consistent readings──▶ nearby
check ──consistent readings──▶ recovered ──hold──▶ nearby
```
One vibration per incident. A single stray packet never re-triggers the motor.
