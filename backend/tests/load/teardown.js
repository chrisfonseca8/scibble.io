import { userID_socket_Map } from "./websocket.js";

export const closeAllSockets = () => {

    console.log("\nClosing all sockets...\n");

    let count = 0;

    for (const socket of userID_socket_Map.values()) {

        socket.close();
        count++;

    }

    console.log(`Successfully closed ${count} sockets.`);

};