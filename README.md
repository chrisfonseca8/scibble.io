

https://github.com/user-attachments/assets/563f799c-dcc4-4a50-ad91-5a19e5e0debd


# scibble.io

A real-time multiplayer drawing and guessing game. Players join private rooms, take turns drawing a secret word, and guess it in chat while the server keeps every client's canvas, timer and score in sync.

**[Live demo](https://scibble-io.vercel.app)** · Node.js · Express · WebSockets (`ws`) · Redis · React (Vite) · Docker

## Highlights

- **Server-authoritative game state.** Rooms move through `WAITING → IN_ROUND → FINISHED`; clients never decide the score, the timer or the word.
- **The secret word never leaks.** Only the drawer's socket receives the word (targeted emit); everyone else sees its length. Guesses are intercepted and normalized server-side, so a correct guess is replaced by a `correct_guess` event instead of being broadcast as chat.
- **Real-time canvas.** The drawer's strokes are relayed to every other player in the room; nothing is persisted beyond the active turn.
- **Turn engine.** Round-robin drawer selection, word choices with a timeout fallback, a server-side countdown synced by `tick` events, automatic round progression and a final leaderboard.
- **Failure handling.** A drawer disconnect ends the turn, a host disconnect promotes the next player, and an empty room is evicted from Redis.
- **Redis-backed room and player state**, so game state is not tied to one process.

## Game flow

Create or join a room → wait for players → host starts → drawer selected → word chosen → strokes streamed → players guess → scores updated → next turn → next round → final results.

## Architecture

```text
React client ──REST──► Express API ──► Redis (room:{id}, player membership)
      │                                   ▲
      └────WebSocket────► ws server ──────┘
                          (identify → lobby → turns → strokes/chat → game_over)
```

1. `POST /rooms` creates a room (UUID) and a player, stored in Redis with status `WAITING`.
2. `POST /rooms/:id/join` validates existence, capacity and status; the last slot closes the room for joining.
3. The client opens a WebSocket and sends `identify`; the server checks the pair against Redis membership before binding the socket to the player.
4. Host-only events (`update_settings`, `start_game`) are authorized by the `isHost` flag.

## Benchmarks

Measured with a custom concurrency script (one run per setting; details in [`docs/benchmarks`](docs/benchmarks)).

| | 50 rooms (300 sockets) | 100 rooms (600 sockets) |
|---|---:|---:|
| Room creation | 50 / 50 OK | 100 / 100 OK |
| Join requests | 250 / 250 OK | 500 / 500 OK |
| WebSocket handshakes completed | 300 / 300 (100%) | **524 / 600 (87%)** |
| Games started | 50 / 50 | 87 / 100 |
| Stroke events relayed | 5,000 | 8,700 |
| Chat / guess events processed | 5,000 | 8,740 |
| Mean `POST /rooms` latency | 773 ms | 930 ms |
| Mean join latency | 2,449 ms | 3,300 ms |

**Finding:** REST stayed at 100% success, but handshake completion fell to 87% at 600 sockets. The bottleneck is the WebSocket upgrade path under a connection burst, not Redis or the REST layer, so the next optimization target is connection-handling concurrency.

## Run it locally

Requires Docker.

```bash
git clone https://github.com/chrisfonseca8/scibble.io.git
cd scibble.io
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Redis: started by Compose (`REDIS_URL=redis://redis:6379`)

## Project structure

```text
backend/    Express + ws server, Redis state, game services
frontend/   React (Vite) client
docs/       Benchmark results and data-flow walkthrough
docker-compose.yml
```

## Limitations and next steps

- Handshake completion degrades at 600 concurrent sockets (see above).
- REST latencies (about 0.8 to 3.3 s mean under the benchmark load) are high and should be profiled.
- Benchmarks are single runs on one machine.
