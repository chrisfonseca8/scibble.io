import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const BASE_URL = process.env.API_BASE_URL || process.env.BACKEND_URL || DEFAULT_BASE_URL;
export const API_BASE_URL = `${BASE_URL.replace(/\/$/, '')}/api`;
export const WS_URL = process.env.WS_URL || `${BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;

export function printHeader(title) {
    console.log('\n===================================');
    console.log(title);
    console.log('===================================\n');
}

export function printPayload(label, payload) {
    console.log(`${label}:`);
    console.log(JSON.stringify(payload, null, 2));
}

export function printResponse(status, data) {
    console.log(`Response Status: ${status}`);
    console.log('\nResponse Data:');
    console.log(JSON.stringify(data, null, 2));
}

export async function waitFor(ms = 250) {
    await delay(ms);
}

export async function makeRequest(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data = text;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = text;
    }

    return { response, data, text };
}

export async function connectWebSocket() {
    return await new Promise((resolve, reject) => {
        const socket = new WebSocket(WS_URL);
        const timer = setTimeout(() => {
            socket.terminate();
            reject(new Error(`Timed out connecting to WebSocket at ${WS_URL}`));
        }, 5000);

        socket.once('open', () => {
            clearTimeout(timer);
            resolve(socket);
        });

        socket.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

export async function waitForSocketMessage(socket, predicate, timeoutMs = 5000) {
    return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Timed out waiting for WebSocket message.'));
        }, timeoutMs);

        const cleanup = () => {
            socket.off('message', onMessage);
            socket.off('error', onError);
            clearTimeout(timeout);
        };

        const onError = (error) => {
            cleanup();
            reject(error);
        };

        const onMessage = (raw) => {
            try {
                const parsed = JSON.parse(raw.toString());
                if (predicate(parsed)) {
                    cleanup();
                    resolve(parsed);
                }
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        socket.on('message', onMessage);
        socket.on('error', onError);
    });
}

export function closeSocket(socket) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
}

export async function runScenario(name, fn) {
    printHeader(`${name} TEST STARTED`);

    try {
        console.log('Sending request...\n');
        const result = await fn();
        console.log('\nTEST PASSED');
        return result;
    } catch (error) {
        console.error('\nTEST FAILED');
        console.error(error?.message || error);
        process.exitCode = 1;
        return false;
    }
}
