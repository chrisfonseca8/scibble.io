// NOTE: the original main.js also imported "./chat.js" and
// "./drawing.js" and called startDrawingCanvas() on START_GAME.
// Neither file is part of this batch (game screen isn't in scope
// here), so those imports would 404 the module graph. Waiting.js
// now owns the START_GAME -> showScreen("game") transition per the
// message-ownership rules; wire the canvas/chat setup back in here
// (or in a dedicated game.js) once those files are back in scope.
import "./home.js";
import "./waiting.js";
import "./chat.js";
import "./drawing.js";
import "./game.js"

import { showScreen } from "./screens.js";

showScreen("home");