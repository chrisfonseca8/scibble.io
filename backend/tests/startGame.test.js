import {
    closeSocket,
    connectWebSocket,
    printPayload,
    printResponse,
    runScenario,
    waitForSocketMessage
} from './helpers/testRunner.js';
import { makeRequest } from './helpers/testRunner.js';

await runScenario('START GAME', async () => {
    const createPayload = { username: 'Chris' };
    const createRoomResponse = await makeRequest('/createRoom', {
        method: 'POST',
        body: createPayload
    });

    if (createRoomResponse.response.status !== 200) {
        throw new Error('Create-room setup step failed.');
    }

    const roomID = createRoomResponse.data?.data?.roomID;
    const userID = createRoomResponse.data?.data?.userID;
    const socket = await connectWebSocket();

    try {
        socket.send(JSON.stringify({
            type: 'JOIN_ROOM',
            payload: {
                roomID,
                userID,
                username: 'Chris'
            }
        }));

        await waitForSocketMessage(socket, (message) => message?.type === 'CONNECTED');

        const startMessage = {
            type: 'START_GAME',
            payload: {}
        };

        printPayload('WebSocket Payload', startMessage);
        socket.send(JSON.stringify(startMessage));

        const response = await waitForSocketMessage(socket, (message) => message?.type === 'START_GAME');
        printResponse(200, response);

        return response;
    } finally {
        closeSocket(socket);
    }
});
