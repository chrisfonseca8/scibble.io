import {
    closeSocket,
    connectWebSocket,
    printPayload,
    printResponse,
    printHeader,
    runScenario,
    waitForSocketMessage
} from './helpers/testRunner.js';
import { makeRequest } from './helpers/testRunner.js';

await runScenario('WEBSOCKET', async () => {
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
        const joinMessage = {
            type: 'JOIN_ROOM',
            payload: {
                roomID,
                userID,
                username: 'Chris'
            }
        };

        printPayload('WebSocket Payload', joinMessage);
        socket.send(JSON.stringify(joinMessage));

        const response = await waitForSocketMessage(socket, (message) => message?.type === 'CONNECTED');
        printResponse(200, response);

        if (response?.payload?.roomID !== roomID) {
            throw new Error(`Unexpected JOIN_ROOM response: ${JSON.stringify(response)}`);
        }

        return response;
    } finally {
        closeSocket(socket);
    }
});
