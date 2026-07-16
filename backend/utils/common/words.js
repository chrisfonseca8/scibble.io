export const WORD_BANK = [
    "elephant", "guitar", "rainbow", "castle", "bicycle",
    "dragon", "volcano", "penguin", "rocket", "sandwich",
    "umbrella", "octopus", "pyramid", "skateboard", "telescope",
    "waterfall", "cactus", "helicopter", "lighthouse", "dinosaur",
    "snowman", "butterfly", "campfire", "jellyfish", "windmill",
    "spaceship", "mountain", "treasure", "robot", "kangaroo"
];

// Picks `count` distinct words from WORD_BANK for the drawer to choose
// from during WORD_SELECTION.
export const getWordOptions = (count = 3) => {

    const pool = [...WORD_BANK];
    const options = [];

    for (let i = 0; i < count && pool.length > 0; i++) {
        const index = Math.floor(Math.random() * pool.length);
        options.push(pool.splice(index, 1)[0]);
    }

    return options;
};
