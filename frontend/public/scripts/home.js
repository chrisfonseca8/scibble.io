import { connectSocket, sendMessage, on } from "./socket.js";
import { showScreen } from "./screens.js";
import { state } from "./state.js";
import { renderLobby } from "./waiting.js";

const avatar = document.getElementById("avatar");
const left = document.getElementById("left");
const right = document.getElementById("right");
const randomBtn = document.getElementById("randomBtn");
const createRoom = document.getElementById("createRoom");
const joinRoom = document.getElementById("joinRoom");
const username = document.getElementById("username");
const language = document.getElementById("language");

const avatars = [
    "robot",
    "kitty",
    "bear",
    "cat",
    "pixel",
    "ghost",
    "alien",
    "duck",
    "lion",
    "dragon",
    "fox",
    "dog",
    "owl",
    "frog",
    "tiger"
];

let current = 0;

const isLocalDev = ["localhost", "127.0.0.1"].includes(
    window.location.hostname
);

 const API_BASE_URL = isLocalDev
    ? "http://localhost:3000/api"
    : "https://scibble-io.onrender.com/api";

 const WS_URL = isLocalDev
    ? "ws://localhost:3000/ws"
    : "wss://scibble-io.onrender.com/ws";

function updateAvatar() {
    avatar.src = `https://api.dicebear.com/8.x/bottts/svg?seed=${avatars[current]}`;
}

updateAvatar();

left.onclick = () => {

    current--;

    if (current < 0)
        current = avatars.length - 1;

    updateAvatar();
};

right.onclick = () => {

    current++;

    if (current >= avatars.length)
        current = 0;

    updateAvatar();
};

randomBtn.onclick = () => {

    current = Math.floor(Math.random() * avatars.length);

    updateAvatar();

};

// Home screen owns CONNECTED and ERROR per the message-ownership rules.
// It still delegates the actual lobby rendering to waiting.js so there's
// one place that knows how to draw the player list.
on("CONNECTED", (payload) => {

    console.log("Joined Room");

    state.hostID = payload.hostID || null;
    renderLobby(payload.players, payload.limit, state.hostID);

    showScreen("waiting");

    setButtonsDisabled(false);
});

on("ERROR", (payload) => {

    alert(payload.message);

    setButtonsDisabled(false);
});

function setButtonsDisabled(disabled) {
    createRoom.disabled = disabled;
    joinRoom.disabled = disabled;
}

// Shared by both createRoom and joinRoom once each has its roomID/userID
// from the HTTP step — everything from here on is identical for host
// and joiner: open (or reuse) the one socket, send JOIN_ROOM, and let
// the CONNECTED/ERROR handlers above take it from there.
function connectAndJoinRoom(roomID, userID) {

    const socket = connectSocket();

    const join = () => {

        sendMessage("JOIN_ROOM", {
            roomID,
            userID,
            username: state.username
        });

    };

    if (socket.readyState === WebSocket.OPEN) {
        join();
    } else {
        socket.addEventListener("open", join, { once: true });
    }
}

createRoom.onclick = async () => {

    if (username.value.trim() === "") {
        alert("Please enter your name.");
        return;
    }

    setButtonsDisabled(true);

    const body = {
        username: username.value.trim(),
        language: language.value,
        avatar: avatars[current]
    };

    try {

        const response = await fetch(`${API_BASE_URL}/createRoom`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error("Unable to reach the server.");
        }

        const result = await response.json();

        if (!result.status) {
            throw new Error(result.message);
        }

        const { roomID, userID } = result.data;

        state.roomID = roomID;
        state.userID = userID;
        state.username = body.username;
        state.language = body.language;
        state.avatar = body.avatar;

        connectAndJoinRoom(roomID, userID);

        // Buttons re-enable from the CONNECTED/ERROR handlers above,
        // once the server actually responds over the socket — not
        // immediately after send(), which let people double-submit
        // before the server had a chance to reply.

    }
    catch (error) {
        console.log(error)

        console.error(error);

        alert(error.message);

        setButtonsDisabled(false);

    }

};

joinRoom.onclick = async () => {

    if (username.value.trim() === "") {
        alert("Please enter your name.");
        return;
    }

    // Placeholder for a real "enter room code" input — prompt() is a
    // stand-in until there's a proper field on the home screen.
    const roomID = window.prompt("Enter the room code:");

    if (!roomID || !roomID.trim()) {
        return;
    }

    setButtonsDisabled(true);

    const body = {
        username: username.value.trim(),
        roomID: roomID.trim()
    };

    try {

        const response = await fetch(`${API_BASE_URL}/joinRoom`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error("Unable to reach the server.");
        }

        const result = await response.json();

        if (!result.status) {
            throw new Error(result.message);
        }

        const { roomID: joinedRoomID, userID } = result.data;

        state.roomID = joinedRoomID;
        state.userID = userID;
        state.username = body.username;

        connectAndJoinRoom(joinedRoomID, userID);

    }
    catch (error) {

        console.log(error);
        console.error(error);

        alert(error.message);

        setButtonsDisabled(false);

    }

};
