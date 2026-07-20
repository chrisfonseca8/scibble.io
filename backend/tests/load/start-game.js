import { roomAdminMap } from "./create-room.js";
import { userID_socket_Map } from "./websocket.js";


const sendStartGame = async () => {

    let successfulRequests = 0;
    let failedRequests = 0;

    for (const [roomID, adminUserID] of roomAdminMap) {

        const socket = userID_socket_Map.get(adminUserID);

        if (!socket) {
            console.log(
                `No socket found for admin ${adminUserID}`
            );

            failedRequests++;
            continue;
        }

        socket.send(
            JSON.stringify({
                type: "START_GAME",
                payload: {}
            })
        );

        successfulRequests++;

        // console.log(
        //     `START_GAME sent -> RoomID: ${roomID}`
        // );
    }


    console.log(
        "\n========== START GAME RESULTS ==========\n"
    );

    console.log(
        `Total Requests      : ${roomAdminMap.size}`
    );

    console.log(
        `Successful Requests : ${successfulRequests}`
    );

    console.log(
        `Failed Requests     : ${failedRequests}`
    );

};


export { sendStartGame };