// Swaps which screen div is visible. This replaces
// window.location.href navigation between separate HTML pages —
// the socket, and everything else in memory, stays alive across
// a screen change now.
const screens = {
    home: document.getElementById("home-screen"),
    waiting: document.getElementById("waiting-screen"),
    game: document.getElementById("game-screen")
};

export function showScreen(name) {

    Object.entries(screens).forEach(([key, el]) => {

        if (!el) return;

        el.style.display = key === name ? "flex" : "none";
    });
}