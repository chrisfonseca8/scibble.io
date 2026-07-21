

https://github.com/user-attachments/assets/563f799c-dcc4-4a50-ad91-5a19e5e0debd





# Real-Time Multiplayer Drawing & Guessing Game

A real-time multiplayer drawing and guessing game inspired by Scribble, built with an event-driven architecture using WebSockets and Redis. The application is designed to support low-latency communication, synchronized canvas rendering, scalable room management, and turn-based gameplay across multiple concurrent game sessions.

Players can create private rooms, participate in multiple game rounds, draw randomly assigned words, and compete by guessing them in real time. The game engine handles player synchronization, timers, scoring, word selection, and automatic state transitions to ensure a seamless multiplayer experience.

The backend leverages WebSockets for bidirectional communication and Redis for efficient room and game state management, enabling scalable handling of concurrent player interactions while maintaining consistency across all connected clients.

## Features

- Real-time multiplayer gameplay
- WebSocket-based low-latency communication
- Private room creation and management
- Synchronized canvas drawing across all connected players
- Live chat and word guessing system
- Turn-based game engine with automatic round progression
- Dynamic word selection and timer management
- Real-time score tracking and leaderboard updates
- Redis-backed room and player state management
- Event-driven architecture for game state synchronization
- Dockerized deployment setup for easy scalability

## Tech Stack

- Node.js
- Express.js
- WebSockets (`ws`)
- Redis
- React (Vite)
- Docker & Docker Compose
- Nginx
- Upstash Redis
- Render

## Game Flow

```text
Create / Join Room
        ↓
Wait for Players
        ↓
Start Game
        ↓
Select Drawer
        ↓
Choose a Word
        ↓
Synchronize Drawing Events
        ↓
Players Guess the Word
        ↓
Update Scores
        ↓
Next Turn
        ↓
Next Round
        ↓
Display Final Results
```

## System Highlights

- Scalable real-time multiplayer architecture.
- Event-driven game state management using WebSockets.
- Redis-powered room and player synchronization.
- Efficient handling of concurrent player actions and game events.
- Low-latency canvas synchronization across all clients.
- Automated timers, round management, and score computation.
- Designed to support multiple concurrent game sessions with consistent state management.
