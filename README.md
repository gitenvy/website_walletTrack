# Tali: wearable belongings reminder

Phone app and pitch demo for the wearable that taps your wrist before you leave an item behind.

| File | What it is |
| --- | --- |
| `index.html` | **Pitch stage.** On a laptop or projector, the app runs inside a phone frame and a presenter panel triggers real-life moments with narration, the wristband tap and a room map. On a phone it opens the app full screen, with a small **Demo** button. |
| `app.html` | **The phone app.** Today's carry, My items, Carry lists, Activity and Settings. Includes a lock-screen notification when an item is left behind. |
| `js/engine.js` | Alert state machine (the reference for the firmware) plus the demo receiver used until the hardware is ready. |
| `js/transport.js` | Data source: demo receiver, or the real receiver over Wi-Fi (`docs/API.md`). |
| `docs/API.md` | Receiver HTTP API, Bluetooth UUIDs and state machine, for the hardware lead. |
| `firmware/tali_receiver/` | ESP32 Arduino skeleton implementing the API. **Not yet compiled or tested on hardware.** |

## Run it

The two pages must be served over HTTP (not opened as a file), so the presenter can control the app frame.

Tali runs on **port 8001**, so it never clashes with the team's other "Wallet Tracker" page on port 8000.

### Open it

| Page | Address |
| --- | --- |
| Pitch demo (phone frame + presenter controls) | **<http://localhost:8001>** |
| App only (full screen, best on a phone) | **<http://localhost:8001/app.html>** |

### Start the server first

**Windows:** double-click **`start-tali.bat`**. It serves this folder on port 8001 and opens the demo in your browser.
Or in PowerShell, **inside this folder**:

```powershell
python -m http.server 8001
```

**Mac:** in Terminal, **inside this folder**:

```bash
python3 -m http.server 8001
```

(If macOS offers to install the Command Line Tools, accept, then run the command again.)

Keep that window open while you use the demo; press **Ctrl+C** in it to stop. Don't add `-d website`, which serves a
different folder. If <http://localhost:8001> shows anything other than the Tali demo, check that you started the
server from inside this folder.

**On your phone (same Wi-Fi):** find the laptop's IP address (Windows: `ipconfig`, Mac: System Settings → Wi-Fi → Details),
then open `http://<that-IP>:8001` on the phone, e.g. `http://192.168.1.23:8001`. Allow Python through the firewall if asked.

## Pitch flow (3 minutes)

1. **You forget your wallet**: the phone locks as you walk out, the band taps, and the lock screen says *Check your Wallet*. Tap the notification, press **Walk back**, and the card shows *Found it*, then Ring.
2. **A friend borrows your phone**: no alarm (the loan tradeoff from the PRD).
3. **You leave with everything**: silent, so no nuisance alerts.
4. Optional, for honesty with the judges: **foil-lined bag** and **tag battery dies** are labelled as known limitations.

Use **Start over** between moments. **Fine control → Speed 2×** shortens waits on stage.

## Switching to the real receiver

App → Settings → Data source → **Receiver (Wi-Fi)**. Join the `Tali-XXXX` Wi-Fi network, then leave the address empty
(if the app is served from the receiver) or enter `http://192.168.4.1`. Nothing else in the UI changes.
Pages served over HTTPS cannot call an `http://` receiver, so use the receiver-hosted page for the live hardware demo.

Per the PRD, label any demo that is not on live hardware as a **pilot preview**. The presenter panel says this.
