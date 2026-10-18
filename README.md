# DateWade Party Arena

A 3D third-person browser party game for 2–8 friends. The catalog contains 300 playable *challenge combinations*, made from 12 mechanically distinct minigame families across 25 increasingly difficult stage variants. These are not 300 independently authored minigame types.

## Local development

Run npm install, npm test, and npm run dev. Open two browser windows and have both join the same room. The host starts a session; participants use WASD/arrow keys or the mobile joystick. The host may add bots.

## Networking

Host-authoritative game simulation with Trystero 0.26's encrypted WebRTC peer-to-peer data channels. Host sends snapshots, peers send directional inputs. Public Nostr relays coordinate discovery. No new paid service. Rooms are ephemeral: the session ends when the host leaves. Room links are not authentication and NAT/firewall restrictions may require a TURN relay.

## Games and challenges

The catalog has 12 rulesets: Bomb Tag, Coin Dash, King of the Hill, Meteor Mayhem, Laser Leap, Shrinking Island, Red Light, Freeze Dance, Checkpoint Rush, Flag Frenzy, Tag Frenzy, Hot Tiles. Each ruleset has 25 stage variants modifying obstacles, speed, hazard frequency, difficulty and theme. 5, 10 or 20 games form a party; score is awarded for each round. The challenge sequence covers all 300 before repeating.

## Performance

Three.js WebGL scene with pixel ratio capped for phones, geometry shared, camera follow interpolation and responsive joystick. 3D requires WebGL 2.
