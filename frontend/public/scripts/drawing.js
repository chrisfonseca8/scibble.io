import { sendMessage, on } from "./socket.js";
import { state } from "./state.js";

// Global-mode p5 (window.setup / window.draw) only works for a single,
// always-present canvas. Since the canvas now only exists once the
// game screen appears, this uses p5 instance mode instead — nothing
// runs, and no canvas is created, until startDrawingCanvas() is called.

let p5Instance = null;
let eraserEnabled = false;

const eraserButton = document.getElementById("eraser-btn");
const clearButton = document.getElementById("clear-canvas-btn");

function sketch(p) {

    p.setup = () => {
        const canvas = p.createCanvas(600, 600);
        canvas.parent("canvas-container");
        p.background(255);
    };

    p.draw = () => {};

    p.mouseDragged = () => {


        if (!state.isDrawer) return;

        p.stroke(eraserEnabled ? 255 : 0);
        p.strokeWeight(4);

        p.line(p.pmouseX, p.pmouseY, p.mouseX, p.mouseY);

        sendMessage("DRAW_EVENT", {
            prevX: p.pmouseX,
            prevY: p.pmouseY,
            currX: p.mouseX,
            currY: p.mouseY,
            width: 4,
            color: eraserEnabled ? "#ffffff" : "#000000"
        });
    };


    p.remoteDraw = (payload) => {

        p.stroke(payload.color);
        p.strokeWeight(payload.width);

        p.line(
            payload.prevX,
            payload.prevY,
            payload.currX,
            payload.currY
        );
    };

    p.clearCanvas = () => p.background(255);
}

export function startDrawingCanvas() {

    if (p5Instance) return;

    p5Instance = new p5(sketch);
}

on("DRAW_EVENT", (payload) => {
    if (p5Instance) p5Instance.remoteDraw(payload);
});

export function clearDrawingCanvas() {
    if (p5Instance) p5Instance.clearCanvas();
}

eraserButton.addEventListener("click", () => {
    if (!state.isDrawer) return;
    eraserEnabled = !eraserEnabled;
    eraserButton.classList.toggle("active", eraserEnabled);
});

clearButton.addEventListener("click", () => {
    if (!state.isDrawer || !p5Instance) return;
    clearDrawingCanvas();
    sendMessage("CLEAR_CANVAS");
});

on("CLEAR_CANVAS", clearDrawingCanvas);
