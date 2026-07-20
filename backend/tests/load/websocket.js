import WebSocket from "ws";
import { roomUsersMap } from "./join-room.js";

const WS_URL = "wss://scibble-io.onrender.com/ws";

const userID_socket_Map = new Map();
const socket_userID_Map = new Map();

const connectUser = async (userID) => {
    return new Promise((resolve) => {

        const socket = new WebSocket(WS_URL);

        socket.on("open", () => {

            // console.log(`Socket Connected -> ${userID}`);

            userID_socket_Map.set(userID, socket);
            socket_userID_Map.set(socket, userID);

            resolve({
                success: true,
                userID,
                socket
            });

        });

        socket.on("error", (error) => {

            //console.log(`Socket Failed -> ${userID}`);
            console.log(error.message);

            resolve({
                success: false,
                userID,
                error: error.message
            });

        });

        socket.on("close", () => {

            userID_socket_Map.delete(userID);
            socket_userID_Map.delete(socket);

        });

    });
};

export const connectAllUsers = async () => {

    const connectionPromises = [];

    for (const [, userIDs] of roomUsersMap) {

        for (const userID of userIDs) {

            connectionPromises.push(
                connectUser(userID)
            );

        }
    }

    const results = await Promise.all(connectionPromises);

    const successfulConnections = results.filter(
        (result) => result.success
    ).length;

    const failedConnections =
        results.length - successfulConnections;

    console.log(
        "\n========== WEBSOCKET RESULTS ==========\n"
    );

    console.log(
        `Total Connections      : ${results.length}`
    );

    console.log(
        `Successful Connections : ${successfulConnections}`
    );

    console.log(
        `Failed Connections     : ${failedConnections}`
    );

};


export {
    userID_socket_Map,
    socket_userID_Map
};