import { sendMessage, on } from "./socket.js";
import { showScreen } from "./screens.js";
import { state } from "./state.js";
import {startDrawingCanvas} from './drawing.js'

const roomCodeEl = document.getElementById("room-code");
const playerListEl = document.getElementById("player-list");
const startGameBtn = document.getElementById("startGameBtn");
const maxPlayersEl = document.getElementById("maxPlayers");
const playerCountEl = document.getElementById("player-count");
// Called from home.js's CONNECTED handler to seed the lobby the
// instant the player arrives, and reused below for LOBBY_UPDATE.

let current_value = 8


maxPlayersEl.addEventListener("change", (event) => {
    current_value = event.target.value
    sendMessage("REDIS_UPDATE",
        {
            limit: current_value,
            roomID:roomCodeEl.textContent

        })
})


function updatePlayerLimitOptions(players) {
    const playerCount = players.length;

    [...maxPlayersEl.options].forEach((option) => {
        option.disabled = Number(option.value) < playerCount;
    });

    // If the currently selected value becomes invalid,
    // automatically select the minimum valid value.
    if (Number(maxPlayersEl.value) < playerCount) {
        maxPlayersEl.value = playerCount;
    }
}

export function renderLobby(players = [], limit, hostID = state.hostID) {
    roomCodeEl.textContent = state.roomID;
    state.hostID = hostID || state.hostID;

    playerListEl.innerHTML = "";

    players.forEach((player) => {
        const li = document.createElement("li");

        li.id = player.userID;
        li.className = "lobby-player";

        const name = document.createElement("span");
        name.className = "lobby-player-name";
        name.textContent = player.username || "Unnamed player";
        li.appendChild(name);

        if (player.userID === state.hostID) {
            const hostBadge = document.createElement("span");
            hostBadge.className = "host-badge";
            hostBadge.textContent = "HOST";
            li.appendChild(hostBadge);
        }

        playerListEl.appendChild(li);
    });

    playerCountEl.textContent = `${players.length}/${limit ?? maxPlayersEl.value}`;

    if (limit !== undefined && limit !== null) {
        maxPlayersEl.value = String(limit);
    }

    const isHost = state.userID === state.hostID;
    maxPlayersEl.disabled = !isHost;
    startGameBtn.disabled = !isHost;

    updatePlayerLimitOptions(players);
}

// Per the protocol, LOBBY_UPDATE always carries the complete player
// list — the client fully redraws rather than diffing individual
// join/leave events (there's no PLAYER_JOINED/PLAYER_LEFT message
// in the protocol, only LOBBY_UPDATE and CONNECTED).
on("LOBBY_UPDATE", (payload) => {
    renderLobby(payload.players, payload.limit, payload.hostID);
});

// Waiting screen owns START_GAME.
on("START_GAME", () => {
    showScreen("game");
    startDrawingCanvas()
});

startGameBtn.onclick = () => {

    sendMessage("START_GAME");

};
