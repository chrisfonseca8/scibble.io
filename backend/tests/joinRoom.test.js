import {
    makeRequest,
    printPayload,
    printResponse,
    runScenario
} from './helpers/testRunner.js';

await runScenario('JOIN ROOM', async () => {
    const createPayload = { username: 'Chris' };
    const createRoomResponse = await makeRequest('/createRoom', {
        method: 'POST',
        body: createPayload
    });

    if (createRoomResponse.response.status !== 200) {
        throw new Error('Create-room setup step failed.');
    }

    const roomID = createRoomResponse.data?.data?.roomID;
    const joinPayload = {
        username: 'Jamie',
        roomID
    };

    printPayload('Payload', joinPayload);

    const { response, data } = await makeRequest('/joinRoom', {
        method: 'POST',
        body: joinPayload
    });

    printResponse(response.status, data);

    if (response.status !== 200) {
        throw new Error(`Expected HTTP 200 but received ${response.status}`);
    }

    if (!data?.status || !data?.data?.userID || data?.data?.roomID !== roomID) {
        throw new Error(`Unexpected join-room response: ${JSON.stringify(data)}`);
    }

    return data;
});
