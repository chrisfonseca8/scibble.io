# Scribble.io Clone

A real-time multiplayer drawing and guessing game inspired by Scribble.io. Players can create or join rooms, draw selected words, and compete with others by guessing them in real time.

The application is built using WebSockets for low-latency communication and Redis for scalable room and game state management. It supports synchronized canvas drawing, real-time chat, turn-based gameplay, and automated game state transitions, making it suitable for handling multiple concurrent game sessions.

## Features

- Real-time multiplayer gameplay using WebSockets.
- Create and join private game rooms.
- Synchronized canvas drawing across all players.
- Real-time chat and word guessing system.
- Turn-based drawer selection and scoring.
- Multiple game rounds with automatic state transitions.
- Redis-backed room and player management.
- Automatic game timers and round handling.
- Scalable architecture for concurrent game sessions.
- Responsive frontend built with React.

## Tech Stack

- Node.js
- Express.js
- WebSockets (`ws`)
- Redis
- React (Vite)
- Docker & Docker Compose
- Nginx
- Render (Deployment)
- Upstash Redis

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
Draw on Canvas
        ↓
Players Guess the Word
        ↓
Award Points
        ↓
Next Turn
        ↓
Next Round
        ↓
Display Final Scores
```

## System Highlights

- Event-driven architecture using WebSockets.
- Redis-based room and player state management.
- Real-time drawing synchronization.
- Efficient handling of concurrent player actions.
- Scalable game state transitions and timer management.
