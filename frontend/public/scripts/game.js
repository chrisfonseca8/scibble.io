import { on, sendMessage } from "./socket.js";
import { showScreen } from "./screens.js";
import { startDrawingCanvas, clearDrawingCanvas } from "./drawing.js";
import { state } from "./state.js";


const gamePlayerListEl = document.getElementById("game-player-list");
const roundDisplayEl = document.getElementById("round-display");
const wordDisplayEl = document.getElementById("word-display");
const timerDisplayEl = document.getElementById("timer-display");

const wordSelectOverlay = document.getElementById("word-select-overlay");
const wordOptionsEl = document.getElementById("word-options");

const roundEndOverlay = document.getElementById("round-end-overlay");
const roundEndWordEl = document.getElementById("round-end-word");
const roundEndScoresEl = document.getElementById("round-end-scores");

const gameOverOverlay = document.getElementById("game-over-overlay");
const gameOverWinnerEl = document.getElementById("game-over-winner");
const gameOverScoresEl = document.getElementById("game-over-scores");

let currentDrawerID = null;
let timerInterval = null;

function hideAllOverlays() {
    wordSelectOverlay.style.display = "none";
    roundEndOverlay.style.display = "none";
    gameOverOverlay.style.display = "none";
}

function renderPlayers(players) {

    gamePlayerListEl.innerHTML = "";

    (players || []).forEach((player) => {

        const li = document.createElement("li");

        const isDrawer = player.userID === currentDrawerID;

        if (isDrawer) li.classList.add("is-drawer");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = (isDrawer ? "✏️ " : "") + (player.username || "");

        nameSpan.className = "game-player-name";
        nameSpan.textContent = player.username || "Unnamed player";

        const detailsSpan = document.createElement("span");
        detailsSpan.className = "player-role";
        if (isDrawer) detailsSpan.textContent = "DRAWING";
        if (player.userID === state.hostID) {
            detailsSpan.textContent = detailsSpan.textContent
                ? `${detailsSpan.textContent} · HOST`
                : "HOST";
        }

        const pointsSpan = document.createElement("span");
        pointsSpan.className = "player-points";
        pointsSpan.textContent = `${player.points ?? 0} pts`;

        li.appendChild(nameSpan);
        if (detailsSpan.textContent) li.appendChild(detailsSpan);
        li.appendChild(pointsSpan);

        gamePlayerListEl.appendChild(li);
    });
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function startTimer(timerEndsAt) {

    stopTimer();

    const tick = () => {
        const remaining = Math.max(0, Math.round((timerEndsAt - Date.now()) / 1000));
        timerDisplayEl.textContent = `${remaining}s`;

        if (remaining <= 0) stopTimer();
    };

    tick();
    timerInterval = setInterval(tick, 1000);
}

on("START_GAME", (payload) => {

    showScreen("game");

    startDrawingCanvas();


});

on("TURN_STARTING", (payload) => {


    hideAllOverlays();
    stopTimer();

    currentDrawerID = payload.drawerID;
    state.isDrawer = payload.drawerID === state.userID;

    roundDisplayEl.textContent = `Round ${payload.round}/${payload.maxRounds}`;
    wordDisplayEl.textContent = "Choose a word...";
    timerDisplayEl.textContent = "--s";

    renderPlayers(payload.players);

    clearDrawingCanvas();

    if (!state.isDrawer) {
        wordOptionsEl.innerHTML = "";
        const message = document.createElement("p");
        message.textContent = `${payload.drawerUsername || "A player"} is choosing a word…`;
        wordOptionsEl.appendChild(message);
        wordSelectOverlay.style.display = "flex";
    }
});

on("WORD_OPTIONS", (payload) => {


    wordOptionsEl.innerHTML = "";

    (payload.options || []).forEach((word) => {

        const btn = document.createElement("button");
        btn.className = "word-option-btn";
        btn.textContent = word;

        btn.onclick = () => {
            sendMessage("SELECT_WORD", { word });
            wordSelectOverlay.style.display = "none";
        };

        wordOptionsEl.appendChild(btn);
    });

    wordSelectOverlay.style.display = "flex";
});

on("ROUND_STARTED", (payload) => {

    wordSelectOverlay.style.display = "none";

    wordDisplayEl.textContent = state.isDrawer
        ? "Draw the word!"
        : "_ ".repeat(payload.wordLength).trim();

    startTimer(payload.timerEndsAt);
});

// This event is sent only to the active drawer.  Keeping it separate from
// ROUND_STARTED guarantees the word is never present in a room broadcast.


on("DRAW_WORD", (payload) => {
  
    if (state.isDrawer) {
        wordDisplayEl.textContent = payload.word || "Draw the word!";
    }

});

on("ROUND_END", (payload) => {

    stopTimer();
    state.isDrawer = false;
    clearDrawingCanvas();

    roundEndWordEl.textContent = `The word was: ${payload.word}`;

    roundEndScoresEl.innerHTML = "";

    (payload.scores || []).forEach((player) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${player.username}</span><span>${player.points}</span>`;
        roundEndScoresEl.appendChild(li);
    });

    roundEndOverlay.style.display = "flex";
});

on("GAME_OVER", (payload) => {

    stopTimer();
    hideAllOverlays();

    const winner = payload.winner;

    gameOverWinnerEl.textContent = winner
        ? `🏆 ${winner.username} wins with ${winner.points} points!`
        : "";

    gameOverScoresEl.innerHTML = "";

    (payload.scores || []).forEach((player) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${player.username}</span><span>${player.points}</span>`;
        gameOverScoresEl.appendChild(li);
    });

    gameOverOverlay.style.display = "flex";
});
