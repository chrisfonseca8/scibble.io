const CREATE_ROOM_URL =
    "https://scibble-io.onrender.com/api/createRoom";

const TOTAL_ROOMS = 100;

const roomAdminMap = new Map();
const responseTimes = [];

const createRoom = async (index) => {
    const username = `test-user-${index}`;

    const startTime = Date.now();

    try {
        const response = await fetch(CREATE_ROOM_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username,
            }),
        });

        const endTime = Date.now();

        const responseTime = endTime - startTime;

        responseTimes.push(responseTime);

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message);
        }

        const { roomID, userID } = data.data;

        roomAdminMap.set(roomID, userID);

        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

export const createRooms = async () => {
    const requests = [];

    for (let i = 1; i <= TOTAL_ROOMS; i++) {
        requests.push(createRoom(i));
    }

    const results = await Promise.all(requests);

    const successCount = results.filter(Boolean).length;

    console.log("\n========== CREATE ROOM RESULTS ==========\n");

    console.log(`Total Requests      : ${TOTAL_ROOMS}`);
    console.log(`Successful Requests : ${successCount}`);
    console.log(
        `Failed Requests     : ${TOTAL_ROOMS - successCount}`
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

    console.log("\n========== ROOM ADMINS ==========\n");

   // console.log(roomAdminMap);
};

export { roomAdminMap };