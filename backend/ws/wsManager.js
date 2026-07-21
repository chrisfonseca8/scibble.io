import { WebSocket, WebSocketServer } from 'ws';
import { handle_message } from './weRoutes.js';
import { getRoomMembers, getPlayerOrder, removeMember, removePlayerFromOrder, deletePlayerForRoom, getRoomHash, updateRoomFields } from '../services/redis_service/redis_service.js';
import { handleGameDisconnect, teardownRoom } from '../services/game_service/game_service.js';
import { states } from '../utils/common/states.js';

const { WAITING, PLAYING, WORD_SELECTION, ROUND_END, GAME_OVER } = states;

// userID -> { socket, roomID, username, isAlive, connected_AT }
const user_id_details_Map = new Map();
// socket -> userID
const socket_user_id_Map = new Map();

export const add_user_to_Map = (socket, roomID, userID, username) => {

    const value = {
        socket: socket,
        roomID: roomID,
        username: username,
        isAlive: true,
        connected_AT: Date.now()
    };

    user_id_details_Map.set(userID, value);
};

export const add_socket_to_user_id_Map = (socket, userID) => {
    socket_user_id_Map.set(socket, userID);
};

export const get_user_details = (userID) => {
    return user_id_details_Map.get(userID);
};

export const getRoomForSocket = (socket) => {

    const userID = socket_user_id_Map.get(socket);

    if (!userID) return null;

    const details = user_id_details_Map.get(userID);

    return details ? details.roomID : null;
};

export const getUserIDForSocket = (socket) => {
    return socket_user_id_Map.get(socket) || null;
};

const cleanup = (socket) => {

    const userID = socket_user_id_Map.get(socket);

    socket_user_id_Map.delete(socket);
    user_id_details_Map.delete(userID);

    return userID;
};

export const sendJson = (socket, payload) => {

    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }

    socket.send(JSON.stringify(payload));
};


export const buildLobbyPlayers = async (roomID) => {

    const memberIDs = await getRoomMembers(roomID);

    return memberIDs
        .map((userID) => {
            const details = user_id_details_Map.get(userID);
            if (!details) return null;
            return { userID, username: details.username };
        })
        .filter(Boolean);
};


export const broadcastToRoom = async (roomID, payload, excludeSocket = null) => {

    const memberIDs = await getRoomMembers(roomID);

    for (const userID of memberIDs) {

        const details = user_id_details_Map.get(userID);

        if (!details) continue;
        if (details.socket === excludeSocket) continue;

        sendJson(details.socket, payload);
    }
};


export const sendJsonToUser = (userID, payload) => {
    const details = user_id_details_Map.get(userID);
    if (!details) return false;
    sendJson(details.socket, payload);
    return true;
};

export function attach_webscoket_server(server) {

    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024
    });

    wss.on('connection', (socket) => {

      

        socket.on("message", (data) => {

            try {

                const message = JSON.parse(data.toString());

                handle_message(message, socket);

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

        socket.on('close', async () => {

            const userID = socket_user_id_Map.get(socket);
            const details = user_id_details_Map.get(userID);
            const roomID = details ? details.roomID : null;

            cleanup(socket);

            // Never joined a room, or already cleaned up — nothing to broadcast.
            if (!roomID || !userID) return;

            const room = await getRoomHash(roomID);
            const gameState = Number(room.state);
            const wasHost = room.hostID === userID;

            // Finish any state transition while this socket is still a room
            // member.  That prevents another simultaneous close from tearing
            // down the room halfway through this handler and recreating keys.
            if ([WORD_SELECTION, PLAYING, ROUND_END].includes(gameState)) {
                await handleGameDisconnect(roomID, userID);
            }

            const roomAfterDisconnect = await getRoomHash(roomID);
            const orderBeforeRemoval = await getPlayerOrder(roomID);
            const removedPlayerIndex = orderBeforeRemoval.indexOf(userID);
            await removeMember(roomID, userID);
            await removePlayerFromOrder(roomID, userID);

            // An empty room has no reason to keep timers, word options, or
            // Redis state alive.  Do this before game-disconnect logic so a
            // departing drawer cannot schedule another empty-room turn.
            if ((await getRoomMembers(roomID)).length === 0) {
                await teardownRoom(roomID, [userID]);
                return;
            }

            // Keep the saved list index aimed at the same player after a
            // removal. If the drawer left, advanceTurn already selected the
            // following slot in the old list, which shifts down by one.
            if (removedPlayerIndex !== -1 && [WORD_SELECTION, PLAYING, ROUND_END].includes(gameState)) {
                const currentIndex = Number(roomAfterDisconnect.currentDrawerIndex || 0);
                let correctedIndex = currentIndex;

                if (room.currentDrawerID === userID) {
                    correctedIndex = removedPlayerIndex === orderBeforeRemoval.length - 1 ? 0 : removedPlayerIndex;
                } else if (removedPlayerIndex < currentIndex) {
                    correctedIndex = currentIndex - 1;
                }

                if (correctedIndex !== currentIndex) {
                    await updateRoomFields(roomID, { currentDrawerIndex: correctedIndex });
                }
            }

            // A disconnected user is no longer a room member and cannot
            // reconnect with this room-issued ID, so its room-bound player
            // hash can be removed immediately instead of waiting for the
            // last participant to leave.
            await deletePlayerForRoom(roomID, userID);

            // Host disconnect: first still-connected player in the
            // room takes over, per spec.
            if (wasHost) {

                const remainingMemberIDs = await getRoomMembers(roomID);
                const newHostID = remainingMemberIDs.find((id) => user_id_details_Map.has(id));

                if (newHostID) {

                    const newHostDetails = user_id_details_Map.get(newHostID);

                    await updateRoomFields(roomID, {
                        hostID: newHostID,
                        hostName: newHostDetails.username
                    });
                }
            }

            const players = await buildLobbyPlayers(roomID);
            const updatedRoom = await getRoomHash(roomID);

            await broadcastToRoom(roomID, {
                type: "LOBBY_UPDATE",
                payload: {
                    players,
                    limit: Number(updatedRoom.limit),
                    hostID: updatedRoom.hostID
                }
            });
        });

    });

    wss.on('error', (error) => {
        console.log(error);
    });

}
