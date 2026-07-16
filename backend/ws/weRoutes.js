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

            // Once the game is running, only the current drawer may
            // send drawing events — matches "Only the drawer may send
            // drawing events" in the spec. Pre-game (waiting room
            // doodling, if any) is left untouched.
            const room = await getRoomHash(roomID);

            if (Number(room.state) === PLAYING) {

                const userID = socket_userID(socket);

                if (userID !== room.currentDrawerID) return;
            }

            // Sender already rendered the stroke locally on mouseDragged,
            // so exclude them to avoid a duplicate draw call.
            broadcastToRoom(roomID, message, socket);

            break;
        }

        case "CHAT_EVENT": {

            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            const userID = socket_userID(socket);
            const text = message.payload && message.payload.message;

            // While a round is live, chat doubles as guessing — check
            // the message against the current word before treating it
            // as a normal chat message. Outside PLAYING, or once
            // handleGuess reports a (possibly duplicate) correct
            // guess, the raw text must NOT go out as chat, or it would
            // hand the word straight to everyone else.
            if (userID) {

                const guessResult = await handleGuess(roomID, userID, text || "");

                if (guessResult.isCorrectGuess) break;
            }

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

            // Fixed turn order + per-player score hash, per the game
            // logic spec's Redis design. addPlayerToOrder is a no-op
            // if this userID is already in the list (reconnect case).
            await addPlayerToOrder(roomID, userID);
            await createPlayerHash(userID, username, roomID);

            const players = await buildLobbyPlayers(roomID);
            console.log(`lobby players : `);
            console.log(...players)
            console.trace(`lobby players called here `)

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

            console.log("START GAME IS FLAGGED")
            const roomID = getRoomForSocket(socket);

            if (!roomID) return;

            // NOTE: anyone currently in the room can trigger this —
            // there's no host-only check here, matching the existing
            // (pre-game-logic) behavior. Flagging in case you want
            // START_GAME restricted to the room's hostID (available on
            // the room:<roomID> hash).
            const result = await startGame(roomID);

            if (!result.status) {

                sendJson(socket, {
                    type: "ERROR",
                    payload: { message: result.message }
                });

                return;
            }

            // startGame() already broadcasts TURN_STARTING / WORD_OPTIONS
            // once the FSM enters WORD_SELECTION. This START_GAME
            // broadcast is kept so the existing frontend's
            // showScreen("game") / startDrawingCanvas() handlers (in
            // both waiting.js and game.js) still fire the screen swap.
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