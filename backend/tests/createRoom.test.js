import {
    makeRequest,
    printPayload,
    printResponse,
    runScenario
} from './helpers/testRunner.js';

const payload = {
    username: 'Chris'
};

await runScenario('CREATE ROOM', async () => {
    printPayload('Payload', payload);

    const { response, data } = await makeRequest('/createRoom', {
        method: 'POST',
        body: payload
    });

    printResponse(response.status, data);

    if (response.status !== 200) {
        throw new Error(`Expected HTTP 200 but received ${response.status}`);
    }

    if (!data?.status || !data?.data?.roomID || !data?.data?.userID) {
        throw new Error(`Unexpected create-room response: ${JSON.stringify(data)}`);
    }

    return data;
});
