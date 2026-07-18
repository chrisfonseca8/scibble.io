import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'
import { attach_webscoket_server } from '../ws/wsManager.js'
import redis from '../redis/config.js'
import apiRoutes from '../routes/index.js'
import cors from 'cors'

const app = express()
const server = http.createServer(app)
attach_webscoket_server(server)
const FRONTEND_URL = process.env.FRONTEND_URL

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api', apiRoutes)
// app.use(express.static("frontend"));


const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;


// app.post('/rooms', async (req, res) => {
//     try {
//         const roomPayload = {
//             name: 'Math Discussion',
//             admin: uuidv4(),
//             createdAt: new Date().toISOString(),
//             visibility: 'public',
//         }

//         const roomUuid = uuidv4()

//         await redis.set(`room:${roomUuid}`, JSON.stringify(roomPayload))

//         res.status(201).json({
//             message: 'Room created',
//             room: roomPayload,
//         })
//     } catch (error) {
//         console.error('Failed to create room', error)
//         res.status(500).json({
//             message: 'Failed to create room',
//             error: error.message,
//         })
//     }
// })

app.use((err, req, res, next) => {

    const status = err.status || 500;

    if (process.env.NODE_ENV === "development") {

        return res.status(status).json({
            success: false,
            status,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack
            }
        });

    }

    return res.status(status).json({
        success: false,
        status,
        message:
            status === 500
                ? "Internal Server Error"
                : err.message
    });

});

server.listen(PORT, HOST, () => {
    console.log(`Server is running on ${PUBLIC_URL}`);

    const wsURL = PUBLIC_URL
        .replace("https://", "wss://")
        .replace("http://", "ws://");

    console.log(`WebSocketServer is running on ${wsURL}/ws`);
});