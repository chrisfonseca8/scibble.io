import { WebSocket, WebSocketServer } from 'ws';
import { handle_message } from './weRoutes.js';
import { getRoomMembers, removeMember, getRoomHash, updateRoomFields } from '../services/redis_service/redis_service.js';
import { handleGameDisconnect } from '../services/game_service/game_service.js';
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

// Rebuilds the full lobby player list for a room: Redis' members set
// is the source of truth for who belongs to the room, the in-memory
// map fills in the live username for whoever is currently connected.
// A userID present in Redis but not in the map just means that
// connection dropped without a clean close yet — it's skipped rather
// than shown with a blank username.
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

// The actual point of pairing Redis membership with the in-memory
// socket map: look up who belongs to the room (Redis), resolve each
// of those userIDs to their live socket (in-memory), send only to
// them. The previous implementation ignored both and broadcast to
// every socket on the server regardless of room.
export const broadcastToRoom = async (roomID, payload, excludeSocket = null) => {

    const memberIDs = await getRoomMembers(roomID);

    for (const userID of memberIDs) {

        const details = user_id_details_Map.get(userID);

        if (!details) continue;
        if (details.socket === excludeSocket) continue;

        sendJson(details.socket, payload);
    }
};

export function attach_webscoket_server(server) {

    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024
    });

    wss.on('connection', (socket) => {

        console.log('socket from the client connected');

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

            // Drawer/guesser disconnect handling (ending the turn
            // immediately if the drawer left, or recalculating the
            // required-guesser count) only applies once a game is
            // actually running.
            if ([WORD_SELECTION, PLAYING, ROUND_END].includes(gameState)) {
                await handleGameDisconnect(roomID, userID);
            }

            await removeMember(roomID, userID);

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

            await broadcastToRoom(roomID, {
                type: "LOBBY_UPDATE",
                payload: { players }
            });
        });

    });

    wss.on('error', (error) => {
        console.log(error);
    });

}