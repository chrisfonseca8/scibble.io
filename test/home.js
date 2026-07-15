import { connectSocket, sendMessage } from "./socket.js";
import { showScreen } from "./screens.js";
import { state } from "./state.js";

const avatar = document.getElementById("avatar");
const left = document.getElementById("left");
const right = document.getElementById("right");
const randomBtn = document.getElementById("randomBtn");
const createRoom = document.getElementById("createRoom");
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

createRoom.onclick = async () => {

    if (username.value.trim() === "") {
        alert("Please enter your name.");
        return;
    }

    createRoom.disabled = true;

    const body = {
        username: username.value.trim(),
        language: language.value,
        avatar: avatars[current]
    };

    try {

        const response = await fetch("/createRoom", {
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

        const socket = connectSocket();

        socket.onmessage = ({ data }) => {

            const message = JSON.parse(data);

            switch (message.type) {

                case "CONNECTED":

                    console.log("Joined Room");

                    showScreen("waiting");

                    createRoom.disabled = false;

                    break;

                case "ERROR":

                    alert(message.payload.message);

                    createRoom.disabled = false;

                    break;

                default:

                    console.warn("Unknown Message:", message);

            }

        };

        const join = () => {

            sendMessage("JOIN_ROOM", {
                roomID,
                userID
            });

        };

        if (socket.readyState === WebSocket.OPEN) {
            join();
        } else {
            socket.addEventListener("open", join, { once: true });
        }

    }
    catch (error) {

        console.error(error);

        alert(error.message);

        createRoom.disabled = false;

    }

};