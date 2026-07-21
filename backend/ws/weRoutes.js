import { checkRedis,getRoomMembers,update_redis_limit,getRoomState,updateRoomState,addPlayerToOrder,createPlayerHash,getRoomHash } from '../services/redis_service/redis_service.js';
import {
    add_socket_to_user_id_Map,
    add_user_to_Map,
    sendJson,
    broadcastToRoom,
    buildLobbyPlayers,
    getRoomForSocket,
    getUserIDForSocket
} from './wsManager.js';
import { startGame, selectWord, handleGuess } from '../services/game_service/game_service.js';

import { states } from '../utils/common/states.js';
const {WAITING,CLOSED,IN_GAME,PLAYING} = states

const socket_userID = (socket) => getUserIDForSocket(socket);

export const handle_message = async (message, socket) => {

    switch (message.type) {

        case "DRAW_EVENT": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            const room = await getRoomHash(roomID);

            if (Number(room.state) === PLAYING) {

                const userID = socket_userID(socket);

                if (userID !== room.currentDrawerID) return;
            }


            broadcastToRoom(roomID, message, socket);

            break;
        }

        case "CLEAR_CANVAS": {
            const roomID = getRoomForSocket(socket);
            if (!roomID) return;

            const room = await getRoomHash(roomID);
            if (Number(room.state) !== PLAYING || room.currentDrawerID !== socket_userID(socket)) return;

            await broadcastToRoom(roomID, { type: "CLEAR_CANVAS", payload: {} }, socket);
            break;
        }

        case "CHAT_EVENT": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            const userID = socket_userID(socket);
            const text = message.payload && message.payload.message;


            if (userID) {

                const guessResult = await handleGuess(roomID, userID, text || "");

                if (guessResult.isCorrectGuess) break;
            }


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

        
            await addPlayerToOrder(roomID, userID);
            await createPlayerHash(userID, username, roomID);

            const players = await buildLobbyPlayers(roomID);
            const room = await getRoomHash(roomID);

            sendJson(socket, {
                type: "CONNECTED",
                payload: {
                    roomID,
                    userID,
                    players,
                    limit: Number(room.limit),
                    hostID: room.hostID
                }
            });

            // Everyone already in the waiting room needs to see the
            // new player show up.
            await broadcastToRoom(roomID, {
                type: "LOBBY_UPDATE",
                payload: { players, limit: Number(room.limit), hostID: room.hostID }
            }, socket);

     

            break;
        }

        case "START_GAME": {

         
            const roomID = getRoomForSocket(socket);

            if (!roomID) return;


            const room = await getRoomHash(roomID);
            if (room.hostID !== socket_userID(socket)) {
                sendJson(socket, { type: "ERROR", payload: { message: "Only the room host can start the game." } });
                return;
            }

            const result = await startGame(roomID);

            if (!result.status) {

                sendJson(socket, {
                    type: "ERROR",
                    payload: { message: result.message }
                });

                return;
            }

            const players = await getRoomMembers(roomID);

            await broadcastToRoom(roomID, {
                type: "START_GAME",
                payload: {players}
            });

            break;
        }

        case "SELECT_WORD": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            const userID = socket_userID(socket);
            const { word } = message.payload || {};

            const result = await selectWord(roomID, userID, word);

            if (!result.status) {

                sendJson(socket, {
                    type: "ERROR",
                    payload: { message: result.message }
                });
            }

            break;
        }

        case "REDIS_UPDATE": {
   

            const { limit } = message.payload;
            const roomID = getRoomForSocket(socket);
            if (!roomID) return;

            const room = await getRoomHash(roomID);
            if (room.hostID !== socket_userID(socket)) return;

            const limit_num = Number(limit);
            if (!Number.isInteger(limit_num) || limit_num < 2 || limit_num > 8) return;

            await update_redis_limit(limit_num, roomID);

            const players = await buildLobbyPlayers(roomID);

            await broadcastToRoom(roomID, {
                type: "LOBBY_UPDATE",
                payload: {
                    players,
                    limit: limit_num,
                    hostID: room.hostID,
                },
            });

            break;
        }

        default:
            console.log(`Unknown message type: ${message.type}`);
            break;
    }
};
