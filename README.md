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

**Easiest:** double-click **`start-tali.bat`**. It serves this folder and opens the demo in your browser.

Or from PowerShell, **inside this folder** (no `-d` option, which would serve a different folder):

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>. If you see a different "Wallet Tracker" page instead, another server is already
using port 8000: close it, or let `start-tali.bat` move Tali to port 8001. To show it on your phone, put the folder on any static host
(GitHub Pages, Netlify Drop or Vercel) and open the link.

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
