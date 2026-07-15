import { sendMessage, on } from "./socket.js";

// Global-mode p5 (window.setup / window.draw) only works for a single,
// always-present canvas. Since the canvas now only exists once the
// game screen appears, this uses p5 instance mode instead — nothing
// runs, and no canvas is created, until startDrawingCanvas() is called.

let p5Instance = null;

function sketch(p) {

    p.setup = () => {
        const canvas = p.createCanvas(600, 600);
        canvas.parent("canvas-container");
        p.background(0);
    };

    p.draw = () => {};

    p.mouseDragged = () => {

        p.stroke(255);
        p.strokeWeight(4);

        p.line(p.pmouseX, p.pmouseY, p.mouseX, p.mouseY);

        sendMessage("DRAW_EVENT", {
            prevX: p.pmouseX,
            prevY: p.pmouseY,
            currX: p.mouseX,
            currY: p.mouseY,
            width: 4,
            color: "#ffffff"
        });
    };

    // Called from the DRAW_EVENT handler below to render strokes
    // coming from other players.
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
}

export function startDrawingCanvas() {

    if (p5Instance) return;

    p5Instance = new p5(sketch);
}

on("DRAW_EVENT", (payload) => {
    if (p5Instance) p5Instance.remoteDraw(payload);
});
