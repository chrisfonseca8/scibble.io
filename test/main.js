import "./home.js";
import "./waiting.js";
import "./chat.js";

import { on } from "./socket.js";
import { showScreen } from "./screens.js";
import { startDrawingCanvas } from "./drawing.js";

// main.js owns screen transitions that involve more than one module
// (starting the game needs both the screen swap AND the canvas spun up),
// so that logic lives here instead of being split across waiting.js
// and drawing.js.
on("START_GAME", () => {
    showScreen("game");
    startDrawingCanvas();
});

showScreen("home");
