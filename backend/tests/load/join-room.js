import { roomAdminMap } from "./create-room.js";

const JOIN_ROOM_URL =
    "https://scibble-io.onrender.com/api/joinRoom";

const USERS_PER_ROOM = 5;

const roomUsersMap = new Map();
const responseTimes = [];

const joinRoom = async (username, roomID) => {
    const startTime = Date.now();

    try {
        const response = await fetch(JOIN_ROOM_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username,
                roomID,
            }),
        });

        const endTime = Date.now();

        const responseTime = endTime - startTime;

        responseTimes.push(responseTime);

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message);
        }

        return data.data.userID;
    } catch (error) {
        console.log(error.message);
        return null;
    }
};

export const joinRooms = async () => {
    const joinRequests = [];

    // Initialize every room with its admin.
    for (const [roomID, adminUserID] of roomAdminMap) {
        roomUsersMap.set(roomID, [adminUserID]);
    }

    // Create all join requests.
    for (const [roomID] of roomAdminMap) {
        for (let i = 1; i <= USERS_PER_ROOM; i++) {
            const username =
                `${roomID.slice(0, 6)}-player-${i}`;

            const request = joinRoom(
                username,
                roomID
            ).then((userID) => {
                if (userID) {
                    roomUsersMap.get(roomID).push(userID);
                }
            });

            joinRequests.push(request);
        }
    }

    await Promise.all(joinRequests);

    const totalJoinRequests =
        roomAdminMap.size * USERS_PER_ROOM;

    const successfulJoins =
        [...roomUsersMap.values()].reduce(
            (acc, users) => acc + (users.length - 1),
            0
        );

    console.log("\n========== JOIN ROOM RESULTS ==========\n");

    console.log(
        `Total Join Requests : ${totalJoinRequests}`
    );

    console.log(
        `Successful Joins    : ${successfulJoins}`
    );

    console.log(
        `Failed Joins        : ${
            totalJoinRequests - successfulJoins
        }`
    );

    console.log(
        `Average Latency     : ${(
            responseTimes.reduce((a, b) => a + b, 0) /
            responseTimes.length
        ).toFixed(2)} ms`
    );

    console.log(
        `Minimum Latency     : ${Math.min(
            ...responseTimes
        )} ms`
    );

    console.log(
        `Maximum Latency     : ${Math.max(
            ...responseTimes
        )} ms`
    );

    console.log("\n========== ROOM USERS ==========\n");

    //console.log(roomUsersMap);
};

export { roomUsersMap };