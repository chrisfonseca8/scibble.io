import { on } from "./socket.js";
import { showScreen } from "./screens.js";
import { startDrawingCanvas } from "./drawing.js";

const gamePlayerListEl =
    document.getElementById("game-player-list");


function renderPlayers(players){

    gamePlayerListEl.innerHTML = "";

    players.forEach((player)=>{

        const li = document.createElement("li");

        li.textContent = player;

        gamePlayerListEl.appendChild(li);

    });

}


on("START_GAME",(payload)=>{

    showScreen("game");

    renderPlayers(payload.players);

    startDrawingCanvas();

});