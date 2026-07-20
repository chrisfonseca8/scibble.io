import { roomAdminMap } from "./create-room.js";
import { roomUsersMap } from "./join-room.js";
import { userID_socket_Map } from "./websocket.js";

const TOTAL_CHAT_MESSAGES = 20;

export const sendChatEvents = async () => {

    let totalChatEvents = 0;

    for (const [roomID, users] of roomUsersMap) {

        const adminID = roomAdminMap.get(roomID);

        for (const userID of users) {

            // drawer cannot guess
            if (userID === adminID) continue;

            const socket = userID_socket_Map.get(userID);

            if (!socket) continue;

            for (let i = 1; i <= TOTAL_CHAT_MESSAGES; i++) {

                socket.send(
                    JSON.stringify({
                        type: "CHAT_EVENT",
                        payload: {
                            message: `guess-${i}`
                        }
                    })
                );

                totalChatEvents++;
            }
        }
    }

    console.log("\n========== CHAT RESULTS ==========\n");

    console.log(
        `Total Chat Events Sent : ${totalChatEvents}`
    );

};