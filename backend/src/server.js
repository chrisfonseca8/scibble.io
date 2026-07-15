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

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api', apiRoutes)
// app.use(express.static("frontend"));


const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'


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
    const base_url =
        HOST === '0.0.0.0'
            ? `http://localhost:${PORT}`
            : `http://${HOST}:${PORT}`;

    console.log(`server is running on ${base_url}`);
    console.log(
        `WebSocketServer is running on ${base_url.replace('http', 'ws')}/ws`
    );
});
