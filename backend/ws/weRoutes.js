import { checkRedis,getRoomMembers,update_redis_limit,getRoomState,updateRoomState } from '../services/redis_service/redis_service.js';
import {
    add_socket_to_user_id_Map,
    add_user_to_Map,
    sendJson,
    broadcastToRoom,
    buildLobbyPlayers,
    getRoomForSocket
} from './wsManager.js';

import { states } from '../utils/common/states.js';
const {WAITING,CLOSED,IN_GAME} = states

export const handle_message = async (message, socket) => {

    switch (message.type) {

        case "DRAW_EVENT": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            // Sender already rendered the stroke locally on mouseDragged,
            // so exclude them to avoid a duplicate draw call.
            broadcastToRoom(roomID, message, socket);

            break;
        }

        case "CHAT_EVENT": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            // chat.js has no optimistic local append — the sender only
            // sees their own message once it comes back over the socket,
            // so do NOT exclude them here.
            broadcastToRoom(roomID, message);

            break;
        }

        case "JOIN_ROOM": {

            console.log("JOIN_ROOM received");

            const { roomID, userID, username } = message.payload;

            const response = await checkRedis(userID, roomID);

            if (!response.status) {

                sendJson(socket, {
                    type: "ERROR",
                    payload: {
                        message: response.message
                    }
                });

                return;
            }

            add_socket_to_user_id_Map(socket, userID);
            add_user_to_Map(socket, roomID, userID, username);

            const players = await buildLobbyPlayers(roomID);

            sendJson(socket, {
                type: "CONNECTED",
                payload: {
                    roomID,
                    userID,
                    players
                }
            });

            // Everyone already in the waiting room needs to see the
            // new player show up.
            await broadcastToRoom(roomID, {
                type: "LOBBY_UPDATE",
                payload: { players }
            }, socket);

            console.log("Job done");

            break;
        }

        case "START_GAME": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;
            
            await updateRoomState(roomID,IN_GAME);

            const players = await getRoomMembers(roomID);

            // NOTE: anyone currently in the room can trigger this —
            // there's no host-only check here. Flagging in case you want
            // START_GAME restricted to the room's hostID (available on
            // the room:<roomID> hash) before broadcasting.
            await broadcastToRoom(roomID, {
                type: "START_GAME",
                payload: {players}
            });

            break;
        }

        case "REDIS_UPDATE": {
            console.log("REDIS_UPDATE received");

            const { limit, roomID } = message.payload;

            const limit_num = Number(limit);
            const roomID_num = Number(roomID);

            await update_redis_limit(limit_num, roomID_num);

            const players = await getRoomMembers(roomID_num); // however you're getting them

            await broadcastToRoom(roomID_num, {
                type: "LOBBY_UPDATE",
                payload: {
                    players,
                    limit: limit_num,
                },
            });

            break;
        }

        default:
            console.log(`Unknown message type: ${message.type}`);
            break;
    }
};