import { roomAdminMap } from "./create-room.js";
import { userID_socket_Map } from "./websocket.js";

const TOTAL_DRAW_EVENTS = 100;

export const sendDrawEvents = async () => {

    let totalDrawEvents = 0;

    for (const [roomID, adminID] of roomAdminMap) {

        const socket = userID_socket_Map.get(adminID);

        if (!socket) {
            continue;
        }

        for (let i = 0; i < TOTAL_DRAW_EVENTS; i++) {

            socket.send(
                JSON.stringify({
                    type: "DRAW_EVENT",
                    payload: {
                        x: i,
                        y: i,
                        px: i - 1,
                        py: i - 1,
                        color: "#000000",
                        strokeWeight: 4,
                        tool: "pen"
                    }
                })
            );

            totalDrawEvents++;
        }
    }

    console.log("\n========== DRAW RESULTS ==========\n");

    console.log(
        `Total Draw Events Sent : ${totalDrawEvents}`
    );

};