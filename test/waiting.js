import { sendMessage, getSocket } from "./socket.js";
import { state } from "./state.js";

const roomCodeEl = document.getElementById("room-code");
const playerListEl = document.getElementById("player-list");
const startGameBtn = document.getElementById("startGameBtn");

const socket = getSocket();

roomCodeEl.textContent = state.roomID;

socket.onmessage = ({ data }) => {

    const message = JSON.parse(data);

    switch (message.type) {

        case "PLAYER_JOINED":

            addPlayer(message.payload);

            break;

        case "PLAYER_LEFT":

            removePlayer(message.payload.userID);

            break;

        case "LOBBY_UPDATE":

            updateLobby(message.payload.players);

            break;

        case "START_GAME":

            // showScreen("game");
            break;

        case "ERROR":

            alert(message.payload.message);

            break;

    }

};

startGameBtn.onclick = () => {

    sendMessage("START_GAME", {
        roomID: state.roomID
    });

};

function addPlayer(player) {

    const li = document.createElement("li");

    li.id = player.userID;

    li.textContent = player.username;

    playerListEl.appendChild(li);

}

function removePlayer(userID) {

    const player = document.getElementById(userID);

    if (player) {
        player.remove();
    }

}

function updateLobby(players) {

    playerListEl.innerHTML = "";

    players.forEach(addPlayer);

}