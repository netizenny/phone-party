# Phone Party Olympics spec

## Goal
A website that runs on one big screen (TV or laptop). 2 to 4 people scan a QR code and their phones become game controllers, "similar to nintendo switch". It is a party platform that will hold several games. The first game is an Olympics game.

## Who it is for
Friends in the same room, looking at one shared screen. It is free, with no sign-up and no app to install.

## Main parts
1. **Host screen** (laptop/TV browser): shows the lobby, a QR code, menus, the 3D game and results. Menus are run **with the mouse on the big screen**.
2. **Phone controller** (phone browser): opened by scanning the QR code. The player types a name and gets a color.
3. **Server** (runs on Jayden's computer): links the phones to the host screen and passes button presses in real time.
4. **Olympics game**: four events, plus medal scoring.

## How it works
1. Open the site on the laptop. It makes a room and shows a QR code.
2. Each player scans it, opens the controller page and enters a name. They are given a color. 2 to 4 players.
3. On the big screen, choose:
   - **Full Olympics**: play all events in a row. Gold, silver and bronze from each event add up on a medal table, and the overall winner is crowned at the end.
   - **Quick play**: pick one event from a menu. No overall score.
4. Phones send button input. The host screen runs the game and shows the result.
5. **Disconnect**: if a phone drops (for example, the screen locks), the game **pauses**. The player refreshes or re-scans and gets **the same slot** back.

## Controller
- **A fixed gamepad layout** on every event: a D-pad plus A/B buttons, like a Joy-Con.
- **Tilt mode** (later): in tilt events the phone switches to tilt aiming with one fire button. Not in v1 (see Limits).
- Phones use the browser only: no app install, no login.

## Events (v1)
| Event | Input on the fixed pad |
|---|---|
| 100m sprint | Mash or alternate A/B as fast as possible |
| Javelin / long jump | Mash to run up, then press at the right moment to throw or jump (timing) |
| Swimming | Tap in rhythm. Going too fast or too slow costs speed |
| Archery | **Aim with the D-pad** in v1, fire with A. Tilt aiming comes later |

## Design notes
- **3D, low-poly cartoon** look, built in the browser with Three.js. No artist needed.
- Look target is Jayden's reference image: chunky, friendly low-poly athletes, a red running track with white lane lines, a pale blue sky, and soft, flat lighting. A landmark can sit in the background.
- Each player's athlete wears their color, so it is easy to read on a TV.
- **Audio is on the big screen only**: starting gun, crowd cheers and simple music. The phones play no sound and do not vibrate.
- Do not use the real Olympic rings or the word "Olympics" as branding if it ever goes public, because both are trademarked. Use a made-up name and logo. (Note added by Claude, not a decision.)

## Out of scope (v1)
- Remote or online play across locations (same room only)
- Accounts and logins
- App install
- Ads and payments
- Tilt controls (need HTTPS; planned for later)
- Phone vibration and phone audio
- Custom avatars (name + color only)
- Other games on the platform (the platform must allow them later, but v1 ships only the Olympics game)

## Limits
- **Runs on Jayden's computer first.** Phones join over the same Wi-Fi using plain HTTP.
- Tilt needs HTTPS on iPhones, so tilt waits until the game is online (or a tunnel is added).
- Claude builds everything. Jayden tests and gives feedback.
- Cost: $0.
- Tech (Claude's choice, default): Node.js server with Socket.IO for real-time input, Three.js for 3D, a QR code library. Plain web pages, no framework.

## Done means (v1)
- 2 to 4 phones can join by QR code with a name and color.
- All 4 events are playable with the fixed gamepad: sprint, javelin/long jump, swimming, and archery with D-pad aiming.
- Full Olympics mode with a medal table, and quick play mode.
- A phone that drops pauses the game and can rejoin its slot.
- Low-poly 3D scenes plus big-screen sound effects and music.
- Works on both iPhone and Android browsers over home Wi-Fi.

## Decisions and why
| Decision | Why |
|---|---|
| Same room, one screen | A Switch/Jackbox-style party. Remote play would need streaming |
| Run locally first | Fastest to start. Hosting can come later |
| 3D low-poly cartoon | Jayden wanted 3D. Low-poly is doable without an artist (matches the reference image) |
| Fixed gamepad layout | Feels like a real controller. Tilt mode is added for tilt events later |
| Archery uses the D-pad in v1 | Keeps all 4 events in v1 without HTTPS setup |
| Mouse runs the menus | Simple. No need to route menus through phones |
| Pause + rejoin same slot on disconnect | Phones lock often. Losing a slot would ruin the night |
| Both Olympics and quick-play modes | Full night or a quick round |
| Big-screen audio only | iPhones block web vibration. Keeps phones simple |

## Open questions
- Name and logo for the platform and the game (avoid Olympic trademarks).
- Where it goes online later (free host vs. ~$5/month) and when to add HTTPS + tilt.
- Exact scoring rules per event (time, distance, points) and how medals tie-break.
- Is 4 the hard cap, or could more players join later?
- Should players be able to join mid-game, or only in the lobby?

## Next steps
1. **First sitting**: a local Node server, a host page with a QR code, and a phone page with a fixed gamepad. Pressing A on a phone lights up that player's color on the big screen. This proves the controller works.
2. Lobby: name + color, 2 to 4 slots, disconnect pause and rejoin.
3. Three.js scene: a low-poly track and simple athletes in player colors.
4. 100m sprint, fully playable, with results.
5. Javelin/long jump, swimming, archery (D-pad).
6. Full Olympics mode with a medal table, and the quick-play menu.
7. Audio: starting gun, crowd and music.
8. Later: go online with HTTPS, then add tilt mode.
