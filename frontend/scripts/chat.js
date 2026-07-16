import { sendMessage, on } from "./socket.js";

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");

sendBtn.addEventListener("click", sendChatMessage);

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendChatMessage();
    }
});

function sendChatMessage() {

    const text = messageInput.value.trim();

    if (!text) return;

    sendMessage("CHAT_EVENT", { message: text });

    messageInput.value = "";
}

on("CHAT_EVENT", (payload) => {

    const div = document.createElement("div");

    div.className = "message";
    div.textContent = payload.message;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Correct guesses are never echoed back through CHAT_EVENT (that
// would leak the word to everyone else) — the server broadcasts a
// dedicated PLAYER_GUESSED event instead, which this renders as a
// system message.
on("PLAYER_GUESSED", (payload) => {

    const div = document.createElement("div");

    div.className = "message system";
    div.textContent = `${payload.username} guessed the word! (+${payload.pointsAwarded})`;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});
