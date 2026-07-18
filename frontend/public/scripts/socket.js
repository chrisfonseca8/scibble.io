let socket = null;
const handlers = new Map();

export function connectSocket() {

    if (socket) return socket;

    const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname)
        && window.location.port === "5173";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = isLocalDev ? `${window.location.hostname}:3000` : window.location.host;
    socket = new WebSocket(`${protocol}//${host}/ws`);

    // Both home.js and waiting.js need to react to messages on this
    // same socket at different points in the session. A single
    // socket.onmessage assignment can only ever have one owner —
    // whichever module set it last silently wins. This dispatches
    // to every module that subscribed via on(), so home.js owning
    // CONNECTED/ERROR and waiting.js owning LOBBY_UPDATE/START_GAME
    // can coexist on the one shared connection.
    socket.addEventListener("message", (event) => {

        const message = JSON.parse(event.data);

        emit(message.type, message.payload);
    });

    return socket;
}

export function getSocket() {
    return socket;
}

export function sendMessage(type, payload = {}) {

    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(
        JSON.stringify({
            type,
            payload
        })
    );

}

export function on(type, handler) {

    if (!handlers.has(type)) {
        handlers.set(type, []);
    }

    handlers.get(type).push(handler);
}

function emit(type, payload) {

    const list = handlers.get(type);

    if (list) {
        list.forEach((handler) => handler(payload));
    } else {
        console.log("Unhandled message type:", type, payload);
    }
}
