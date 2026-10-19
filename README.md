# DateWade Arena

Top-down multiplayer shootouts in the browser for 2 to 8 friends. PC only (keyboard and mouse).

Last one standing wins the round. After every round, everybody picks 1 of 3 random upgrade cards. Losers get better odds at rare and epic cards so the leader doesn't run away with it. First to 3, 5, 7 or 10 round wins takes the match.

## Playing

1. One person clicks **Create room** and shares the invite link (or the 5 character code).
2. Friends open the link and hit **Join**.
3. Host can add bots to fill the lobby, pick the round count, then **Start match**.

Controls: WASD move, mouse aim, click shoot, Space or right click dash, R reload, 1/2/3 pick cards.

**Practice against bots** works with no network at all.

## How it works

- **Networking:** peer to peer over WebRTC using [Trystero](https://github.com/dmotz/trystero). Matchmaking goes through public Nostr relays, so there is no game server and nothing to pay for. The host's browser runs the real simulation at 60 ticks per second and sends snapshots 30 times a second. Everyone else predicts their own movement locally and reconciles against the host, so your own player feels instant.
- **The host should keep their tab open.** If the host leaves, the room ends. The simulation runs on a worker timer so a backgrounded host tab keeps going.
- **Maps:** 4 maps (Neon Rooftop, Overgrown Ruins, Desert Outpost, Frozen Docks), painted procedurally into an offscreen canvas once per map, then rendered every frame with lighting, weather, particles and decals on top. Layouts are point-symmetric so no spawn is better than another.
- **Cards:** 31 upgrades across common, rare and epic. Stats stack all match and are clamped so builds get silly without breaking the game.

## Code map

| Path | What it does |
| --- | --- |
| `lib/sim.js` | Host-authoritative match: rounds, bullets, damage, zone, upgrades |
| `lib/physics.js` | Movement and collision shared by the host and client prediction |
| `lib/cards.js` | Every upgrade card and the offer odds |
| `lib/maps.js` | Wall layouts and spawns |
| `lib/bot.js` | Bot AI |
| `lib/net.js` | Trystero transport, plus a local two-tab test transport |
| `components/session.js` | Input, host loop, snapshots, client prediction and interpolation |
| `components/renderer.js` | Canvas renderer, effects, weather |
| `components/mapArt.js` | Procedural map painting |
| `components/Game.jsx` | HUD, lobby, upgrade screen, match results |

## Local development

```
npm install
npm test
npm run dev
```

To test multiplayer on one machine without the internet, open `http://localhost:3000/?net=local` in two tabs, create a room in one and join from the other.

## Known limits

- Very strict NATs or corporate firewalls can block peer to peer. If a friend can't connect, try a different network. A TURN relay would fix it but costs money.
- The host's connection carries everyone, so the person with the best internet should host.
