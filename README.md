# Bomb Tag! — DateWade Games

Browser multiplayer party game for 2–8 players. One player holds a ticking bomb and tags others to pass it. Whoever holds it when time runs out is eliminated.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 in two different browsers or devices. Create a room and share the six-character room code or invite link.

## Multiplayer architecture

Trystero 0.26.0 uses public Nostr relays for peer discovery, then connects browsers directly via WebRTC. No dedicated game server or database is needed. The room creator is authoritative for gameplay; when the creator leaves, the match closes. Some firewalls/NATs can prevent P2P connectivity without TURN.

## Controls

Desktop: WASD or arrow keys. Mobile: on-screen D-pad. Up to eight human or bot players. Host can add bots in lobby to practice.

## Important

The invite code is not an authentication mechanism. Rooms are temporary, share game data only, and have no saved leaderboard. For more robust connectivity at scale, add a dedicated signaling/TURN service or managed real-time game backend.
