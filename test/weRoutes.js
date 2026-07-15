import redis from '../redis/config.js'
import { add_socket_to_user_id_Map, add_user_to_Map,sendJson } from './wsManager.js';

export const handle_message = async (message, socket, broadcast) => {
    switch (message.type) {

        case "DRAW_EVENT":
            console.log("DRAW_EVENT received");
            broadcast(message)
            // handleDraw(message.payload, socket);
            break;

        case "CHAT_EVENT":
            console.log("CHAT_EVENT received");
            broadcast(message)

            // handleChat(message.payload, socket);
            break;

            
        case "JOIN_ROOM": {

            console.log("JOIN_ROOM received");

            const { roomID, userID } = message;

            const response = await checkRedis(userID, roomID);

            if (!response.status) {

                sendJson(socket, {
                    type: "ERROR",
                    message: response.message
                });

                return;

            }

            add_socket_to_user_id_Map(socket, userID);
            add_user_to_Map(socket, roomID, userID);

            sendJson(socket, {
                type: "CONNECTED",
                payload: {
                    roomID,
                    userID
                }
            });

            console.log("Job done");

            break;
        }

        default:
            console.log(`Unknown message type: ${message.type}`);
            break;
    }
};