let socket = null;

export function connectSocket() {

    if (socket) return socket;

    socket = new WebSocket("ws://localhost:3000/ws");

    return socket;
}

export function getSocket() {
    return socket;
}

export function sendMessage(type, payload = {}) {

    socket.send(
        JSON.stringify({
            type,
            payload
        })
    );

}