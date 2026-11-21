# Gotcha: full context brief (for another AI)

Product name: **Gotcha** (renamed from "Tali" in November 2026; older files may still say Tali).
Tagline: **"Never leave it behind."**
Who: a student startup team pitching at **Monash Startup Bootcamp 2026 (MSB2026)** in Malaysia. The pitch is **3 minutes**, followed by Q&A, and follows the MSB2026 Participant Guidebook.

## 1. What it is

Gotcha is a wearable reminder that stops you leaving things behind.

- **Master device: a bracelet.** Slim, screenless band with a tiny module: vibration motor, one LED, one button. It **only vibrates** (never beeps). No phone is needed for the alert.
- **Tags:** small Bluetooth (BLE) tags you stick on what matters: wallet, keys, tool pouch, even your phone.
- **The alert:** when you walk away and a tagged item stays behind, the bracelet vibrates in pulses (about 600 ms on, 400 ms off) and the LED turns red, before you reach the door. Press the button to stop it. It stops by itself once the item is back in range.
- **Smart, not noisy (the "loan rule"):** it only alerts when *you* move away. If an item moves away while you sit still (e.g. a friend borrows your phone), it stays quiet. It waits a few seconds to confirm (the confirm window can be 0, 3 or 5 s) before alerting.
- **Companion app (optional):** shows which item was left behind, can ring a tag (on/off toggle, max 60 s) to find it, and manages tags, carry lists, activity and settings. The bracelet works without it.

## 2. The problem

People don't lose things on purpose; they **notice too late**. Example story used in the pitch: in Kuala Lumpur a passenger left their phone charging in a Grab and only noticed after the driver pulled away. Field technicians pack tools, keys and a phone at site after site; one forgotten pouch means driving back. Trackers like AirTag only help after the fact and alert your phone; if the phone is what you forgot, nothing warns you.

## 3. Confirmed data (safe to show)

| Figure | Source |
| --- | --- |
| 88.2% of students have lost an item on campus | Universiti Poly-Tech Malaysia (UPTM) student survey, 51 respondents (supplied by the team; no public link) |
| 66.7% had to replace a lost item | same UPTM survey |
| 68% of UK first-year students lose or break belongings | Virgin Media O2 press release, 19 Sep 2024, "Freshers lose £347 of personal belongings in their first year of Uni" (O2's own research, sample size not stated) |
| £347 average first-year loss/damage per UK student | same O2 release |
| AirTag costs RM129 (single) in Malaysia | TechNave, 2026 (second-generation AirTag) |
| AirTag setup and alerts need an iPhone/iPad | Apple AirTag product page |
| Simulation: 20/20 simulated departures warned before the door with the 3 s rule (5 s rule: 11/20); 120 simulated runs in total | The team's own simulator ("Rule lab"). Always label as **simulation**, not field evidence |

**Rule from the team: never display data that isn't confirmed.** Earlier placeholders such as "[x] of 10 technicians would buy" were removed for this reason.

## 4. Business

- **Beachhead customer:** field technicians and repair shops. **Second market:** university students (supported by the UPTM survey).
- **Product:** starter kit = 1 bracelet + 2 tags, **target price under RM129** (the price of one AirTag), then add-ons (extra tags, mounts, bands). Prices are targets to be tested in the pilot.
- **Cost to make (estimate):** about RM55–100 per kit at 1,000 units; supplier quotes pending. Water/splash resistance estimated to add about RM5–10 per kit.
- **Plan:** Month 1, build 5 pilot kits; Months 2–3, 1-week trials with technicians; Months 4–6, build 100 units **only if the trial works**. Trial goal: 4 of 5 technicians still wearing it on day 7.
- **Ask:** RM2,000 for 5 pilot kits and a 1-week trial (draft split: electronics RM900, cases RM400, testing RM400, spares RM300; the split is a team draft, not verified).
- **Competition:** AirTag and Tile find things after they're lost and alert your phone (AirTag is iPhone-only). Apple Watch alerts only for Apple devices and costs far more. Gotcha stops you leaving the item in the first place, on your wrist, even when the phone is the thing you forgot.
- **Other directions explored (not in the pitch):** form-factor variants such as necklaces/pendants (including a uni-student style and a cute bear pendant for kids) and a kids-focused version.

## 5. Prototype status (be honest about this)

- Working on real boards: **tag detected, tag rings, app demo**.
- **Not yet done:** the walk-away alert running on the bracelet itself.
- ESP32 receiver firmware skeleton exists (`firmware/gotcha_receiver/`) but is **not compiled or tested on hardware**.
- Any demo that isn't live hardware should be called a **pilot preview**.

## 6. Assets and where they are

- **Pitch deck (Canva):** "Gotcha Pitch Deck: Monash Startup Bootcamp 2026", link canva.link/35gi8cz3964tles. 11 slides, clean black/white/grey template, with a timed 3-minute script in the speaker notes:
  1 Title · 2 Meet Our Team · 3 The Problem · 4 The Solution · 5 Market Opportunity (the 4 stats) · 6 Business Model · 7 Feature Comparison (Gotcha vs AirTag) · 8 Market Strategy (6-month plan) · 9 The Ask (RM2,000) · 10 References · 11 Thank You.
  Still to do: real team names and photos (currently template stock photos with role labels), verify "Built in Malaysia" and "Works with Android" on the comparison slide, and check the RM2,000 split.
- **Animated GIF of the problem:** `pitch/left-behind.gif` (cartoon: rider leaves a phone in a ride-hail car, car drives off, "Noticed too late."). Also `pitch/left-behind.mp4`. No Grab logo on purpose.
- **Website demo (code):** GitHub repo `gitenvy/website_walletTrack`. Plain HTML/CSS/JS, no build step.
  - `index.html`: pitch stage showing the bracelet next to the phone app, with presenter controls ("moments" such as You forget your wallet / You leave with everything / A friend borrows your phone, a room map, fine controls and a simulation "Rule lab").
  - `app.html` + `js/app.js`: the companion phone app (Today, My items, Lists, Activity, Settings, lock-screen notification).
  - `js/engine.js`: alert state machine (reference for the firmware) and the simulator. `js/transport.js`: simulated vs real receiver over Wi-Fi.
  - `docs/API.md`: receiver HTTP API, BLE service UUID `7a1e0001-5a1f-4c3b-9d1e-7a11b0000001`, receiver Wi-Fi `Gotcha-XXXX`.
  - Run locally: `start-gotcha.bat` (Windows) or `python3 -m http.server 8001` in the folder, then open http://localhost:8001 (must be served over HTTP, not opened as a file).
- **Hosted demo:** https://claude.ai/artifact/XsSErHA6GA776gFaZ7jx2K (shared with anyone who has the link).

## 7. How the team likes things done

- Visuals: cartoon/flat illustrations, **not** hyper-realistic images.
- Slides: readable on a projector, consistent fonts, the clean Canva template look; short text.
- Only confirmed numbers on slides; label targets as targets, estimates as estimates and simulations as simulations.
- Avoid using real brands' logos (e.g. Grab, Apple) in visuals.
