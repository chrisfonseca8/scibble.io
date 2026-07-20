import { createRooms } from "./create-room.js";
import { joinRooms } from "./join-room.js";
import { connectAllUsers } from "./websocket.js";
import { sendStartGame } from "./start-game.js";
import { sendDrawEvents } from "./draw.js";
import { sendChatEvents } from "./chat.js";
import { closeAllSockets } from "./teardown.js";

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const main = async () => {

    await createRooms();

    await joinRooms();

    await connectAllUsers();

    await sendStartGame();

    console.log("\nWaiting for word selection...\n");

    await sleep(20000);

    await sendDrawEvents();

    await sendChatEvents();

    console.log("\nWaiting before teardown...\n");

    await sleep(5000);

    await closeAllSockets();

    console.log("\n========== LOAD TEST COMPLETE ==========\n");

};

main();