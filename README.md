# Phone Party

Party games on one big screen, with phones as controllers. Players scan a QR code to join (2–4 players).
Events: 100m Sprint, Javelin, Swimming, Skiing.

## Play

Needs [Node.js](https://nodejs.org) (v20 or newer).

```bash
npm install
npm start
```

- Open **http://localhost:3000** on the PC or TV (the big screen).
- Phones scan the QR code on that screen. They must be on the **same Wi-Fi** as the PC.
- The first time, Windows may ask to let Node through the firewall: allow it on **private networks**.
- If the QR code shows the wrong address (VPN/WSL adapters), set it by hand:
  `set HOST_IP=192.168.x.x && npm start`

## Code

| File | What it does |
|---|---|
| `server.js` | Web server + Socket.IO. Links phones to the big screen, keeps player slots, names, rejoin. |
| `public/host.html` | Big screen: lobby, QR code, event buttons, pause screen, all CSS. |
| `public/phone.html` | Phone controller: D-pad + A/B. |
| `public/stadium.js` | Shared 3D stage: renderer, lights, stands, athletes, name tags, results, split screen. |
| `public/sprint.js` / `sprint-logic.js` | 100m sprint: alternate A/B. |
| `public/javelin.js` / `javelin-logic.js` | Javelin: run up, hold ▲ to aim, let go before the line. Turn-based. |
| `public/swim.js` / `swim-logic.js` | Swimming: mash ◀ ▶, press A in the green on the breath meter. |
| `public/ski.js` / `ski-logic.js` | Downhill skiing: hold ◀ ▶ to steer past trees. Split screen. |
| `test/` | Rule checks for each event. Run with `npm test`. |

Each event has a `*-logic.js` file with the rules and tuning numbers at the top (speeds, timings),
and a drawing file that builds the 3D scene. To tweak how an event feels, change the numbers in its logic file
and run `npm test`.

After editing files in `public/`, just refresh the big screen. After editing `server.js`, restart `npm start`.

Spec: `phone-party-olympics-spec.md`.
