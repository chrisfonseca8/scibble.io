let socket = null;
const handlers = new Map();

export function connectSocket() {

    if (socket) return socket;

const isLocalDev =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port === "5173";

const WS_URL = isLocalDev
    ? "ws://localhost:3000/ws"
    : "wss://scibble-io.onrender.com/ws";

socket = new WebSocket(WS_URL);


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
