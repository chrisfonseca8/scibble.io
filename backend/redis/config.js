import Redis from "ioredis";

// This file is gitignored in the repo (see backend/.gitignore) but is
// imported by src/server.js and services/redis_service/redis_service.js,
// so it has to exist for the app to boot. REDIS_URL matches the env var
// docker-compose.yml already sets for the backend service
// (redis://redis:6379); falls back to localhost for running the backend
// outside docker.
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

redis.on("error", (err) => {
    console.error("Redis connection error:", err);
});

export default redis;
