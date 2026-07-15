import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { handle_message } from './weRoutes.js'

 const user_id_details_Map = new Map()
 const socket_user_id_Map = new Map()



export const add_user_to_Map = (socket,roomID,userID) => {
    const userID = userID
    const value = {
        socket:socket,
        roomID: roomID,
        isAlive: true,
        connected_AT: Date.now()
    }

    user_id_details_Map.set(userID, value)
}




export const add_socket_to_user_id_Map = (socket, userID) => {
    socket_user_id_Map.set(socket, userID);
}


const cleanup = (socket) => {
    const user_id = socket_user_id_Map.get(socket)
    socket_user_id_Map.delete(socket)
    user_id_details_Map.delete(user_id)
}



export const sendJson=(socket, payload) =>{
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }
    socket.send(JSON.stringify(payload));
}




export function attach_webscoket_server(server) {

    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024
    })

    function broadcast(payload) {
        for (const client of wss.clients) {
            if (client.readyState !== WebSocket.OPEN) {
                continue;
            }

            sendJson(client, payload);
        }
    }


    wss.on('connection', (socket) => {
        console.log('socket from the clinte connectied')

        socket.on("message", (data) => {
            try {
                console.log(data);
                const message = JSON.parse(data.toString());
                handle_message(message, socket, broadcast)

                // Later:
                // wsRouter(message, socket);

            } catch (err) {
                console.error(err, err.message);

                sendJson(socket, {
                    type: "ERROR",
                    payload: {
                        message: "Invalid JSON format."
                    }
                });
            }
        });

        socket.on('close', () => {
            cleanup(socket)
        })

    })

    wss.on('error', (error) => {
        console.log(error);
    });

}