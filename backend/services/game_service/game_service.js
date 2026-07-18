import { states } from '../../utils/common/states.js';
import { getWordOptions } from '../../utils/common/words.js';

import {
    getPlayerOrder,
    getRoomHash,
    updateRoomFields,
    clearGuessed,
    addGuessed,
    isGuessed,
    getGuessedCount,
    getPlayer,
    setPlayerConnected,
    incrementPlayerPoints,
    getRoomMembers,
    deleteRoom
} from '../redis_service/redis_service.js';

// broadcastToRoom/sendJson/get_user_details come from wsManager, which
// itself imports handle_message from weRoutes, which imports this
// module — the same circular-import shape weRoutes<->wsManager already
// has today. Safe in ESM as long as nothing here runs at import time,
// only inside functions (which is the case below).
import { broadcastToRoom, sendJson, get_user_details, sendJsonToUser } from '../../ws/wsManager.js';

const { WORD_SELECTION, PLAYING, ROUND_END, GAME_OVER } = states;

const TURN_DURATION_SECONDS = 80;      // matches the "Drawtime 80" already shown in the waiting-room UI
const MAX_ROUNDS = 3;                  // per the spec's own worked example
const WORD_OPTIONS_COUNT = 3;          // matches the "Word Count 3" already shown in the waiting-room UI
const DRAWER_POINTS_PER_GUESSER = 50;
const WORD_SELECTION_GRACE_MS = 15000; // auto-pick if the drawer never selects
const ROUND_END_DELAY_MS = 5000;       // let clients show the scoreboard before the next turn starts

// roomID -> { type, handle } for whichever single timer (word-selection
// grace, turn countdown, or round-end delay) is currently pending for
// that room. In-memory only, single-instance — matches the existing
// user_id_details_Map / socket_user_id_Map pattern in wsManager.js.
const roomTimers = new Map();

// roomID -> word options currently offered to the drawer. Kept out of
// Redis on purpose: the spec is explicit the actual word must never
// reach guessers, and this is choices-not-yet-made state that only
// the server process mid-selection needs.
const pendingWordOptions = new Map();

export const clearRoomTimer = (roomID) => {

    const existing = roomTimers.get(roomID);

    if (!existing) return;

    clearTimeout(existing.handle);
    roomTimers.delete(roomID);
};

// Safe to call more than once.  This is the single teardown entry point for
// an empty room, so timers cannot resurrect an already-deleted game.
export const teardownRoom = async (roomID, additionalUserIDs = []) => {
    clearRoomTimer(roomID);
    pendingWordOptions.delete(roomID);
    await deleteRoom(roomID, additionalUserIDs);
};

const buildPlayersWithScores = async (playerOrder) => {

    const players = await Promise.all(
        playerOrder.map(async (userID) => {
            const player = await getPlayer(userID);
            return {
                userID,
                username: player.username,
                points: Number(player.points || 0),
                connected: player.connected !== "false"
            };
        })
    );

    return players.sort((a, b) => b.points - a.points);
};

const getConnectedPlayerCount = async (playerOrder) => {

    let count = 0;

    for (const userID of playerOrder) {
        const player = await getPlayer(userID);
        if (player && player.connected !== "false") count++;
    }

    return count;
};

// total players - 1 (drawer can't guess), recalculated live off
// currently-connected players so a mid-turn disconnect lowers the bar
// per the spec's "Guesser Disconnect" section.
const getRequiredGuesserCount = async (playerOrder) => {

    const connected = await getConnectedPlayerCount(playerOrder);

    return Math.max(0, connected - 1);
};

export const startGame = async (roomID) => {

    const playerOrder = await getPlayerOrder(roomID);//gets a list of userID beloning  to the roomID
    console.log(`player order is : ${playerOrder},,, type_of : ${typeof (playerOrder)}`)
    console.trace(`this is in startGame`)

    if (playerOrder.length < 2) {
        return { status: false, message: "Need at least 2 players to start." };
    }

    await updateRoomFields(roomID, {
        round: 1,
        maxRounds: MAX_ROUNDS,
        currentDrawerIndex: 0
    });

    await beginTurn(roomID);

    return { status: true };
};

export const beginTurn = async (roomID) => {

    clearRoomTimer(roomID);

    const playerOrder = await getPlayerOrder(roomID);
    console.log(`player order is : ${playerOrder},,, type_of : ${typeof (playerOrder)}`)
    console.trace(`this is in beginTurn()`)

    if (playerOrder.length === 0 || (await getRoomMembers(roomID)).length === 0) {
        await teardownRoom(roomID);
        return;
    }

    const room = await getRoomHash(roomID);
    console.log(typeof (room), room, room.currentDrawerIndex)
    console.trace(`we are tracking the getroomhash details `)
    const drawerIndex = Number(room.currentDrawerIndex || 0) % playerOrder.length;
    const drawerID = playerOrder[drawerIndex];

    console.log(`drawerIndex:${drawerIndex},drawerID:${drawerID}`)

    // Guessed set only exists during a turn — wiped at the start of
    // every one, per spec.
    await clearGuessed(roomID);

    await updateRoomFields(roomID, {
        state: WORD_SELECTION,
        currentDrawerID: drawerID,
        currentWord: "",
        currentWordLength: 0
    });

    const options = getWordOptions(WORD_OPTIONS_COUNT);
    pendingWordOptions.set(roomID, options);





    console.log(`---------------------${drawerID}-------------------------`, typeof (drawerID))
    const drawerDetails = get_user_details(drawerID);
    console.log(`drawerDetails`)
    console.log(drawerDetails);
    console.trace(`drawer details of that turn`)

    const drawerRecord = await getPlayer(drawerID);

    await broadcastToRoom(roomID, {
        type: "TURN_STARTING",
        payload: {
            drawerID,
            drawerUsername: drawerDetails ? drawerDetails.username : drawerRecord.username,
            round: Number(room.round || 1),
            maxRounds: Number(room.maxRounds || MAX_ROUNDS),
            players: await buildPlayersWithScores(playerOrder)
        }
    });

    if (drawerDetails) {
        console.log("SENDING WORD_OPTIONS");
        console.log(options);
        console.log(drawerDetails.username);
        sendJson(drawerDetails.socket, {
            type: "WORD_OPTIONS",
            payload: { options }
        });
    }



    // Drawer disconnecting is handled immediately elsewhere (see
    // handleDisconnect below) — this timeout only covers a connected
    // drawer who simply never picks a word.
    const handle = setTimeout(() => autoSelectWord(roomID), WORD_SELECTION_GRACE_MS);
    roomTimers.set(roomID, { type: "word_selection", handle });
};

const startPlaying = async (roomID, word) => {

    clearRoomTimer(roomID);
    const timerEndsAt = Date.now() + TURN_DURATION_SECONDS * 1000;

    await updateRoomFields(roomID, {
        state: PLAYING,
        currentWord: word,
        currentWordLength: word.length,
        timerEndsAt
    });

    await broadcastToRoom(roomID, {
        type: "ROUND_STARTED",
        payload: {
            wordLength: word.length,
            timerEndsAt,
            durationSeconds: TURN_DURATION_SECONDS
        }
    });

    // The word is intentionally not part of ROUND_STARTED.  Deliver it only
    // to the drawer so the top-of-screen prompt is useful without leaking it
    // to guessers.
    const room = await getRoomHash(roomID);
    const sent = sendJsonToUser(room.currentDrawerID, { type: "DRAW_WORD", payload: { word } });
    if (!sent) {
        console.warn(`Failed to send DRAW_WORD to drawer ${room.currentDrawerID} - drawer not connected or not found`);
    }

    const handle = setTimeout(() => endTurn(roomID, "timeout"), TURN_DURATION_SECONDS * 1000);
    roomTimers.set(roomID, { type: "playing", handle });
};

const autoSelectWord = async (roomID) => {

    const room = await getRoomHash(roomID);

    if (Number(room.state) !== WORD_SELECTION) return;

    const options = pendingWordOptions.get(roomID);

    if (!options || options.length === 0) return;

    pendingWordOptions.delete(roomID);

    await startPlaying(roomID, options[0]);
};

export const selectWord = async (roomID, userID, word) => {

    const room = await getRoomHash(roomID);

    if (Number(room.state) !== WORD_SELECTION) {
        return { status: false, message: "Not currently selecting a word." };
    }

    if (room.currentDrawerID !== userID) {
        return { status: false, message: "Only the drawer can select the word." };
    }

    const options = pendingWordOptions.get(roomID) || [];

    if (!options.includes(word)) {
        return { status: false, message: "Not a valid word option." };
    }

    pendingWordOptions.delete(roomID);

    await startPlaying(roomID, word);

    return { status: true };
};

// Returns whether the incoming chat text should be swallowed as a
// guess (correct, incl. a harmless duplicate) rather than broadcast
// as a normal chat message. The caller (weRoutes) decides what to do
// with a false return (normal chat broadcast).
export const handleGuess = async (roomID, userID, text) => {

    const room = await getRoomHash(roomID);

    if (Number(room.state) !== PLAYING) {
        return { isCorrectGuess: false };
    }

    if (room.currentDrawerID === userID) {
        // The drawer typing anything is never a "guess" — falls
        // through to normal chat.
        return { isCorrectGuess: false };
    }

    const word = room.currentWord || "";

    if (!word || text.trim().toLowerCase() !== word.toLowerCase()) {
        return { isCorrectGuess: false };
    }

    const alreadyGuessed = await isGuessed(roomID, userID);

    if (alreadyGuessed) {
        // Correct, but a duplicate — ignore per spec, no extra points,
        // and still don't leak the word via normal chat broadcast.
        return { isCorrectGuess: true, duplicate: true };
    }

    await addGuessed(roomID, userID);

    const remainingSeconds = Math.max(
        0,
        Math.round((Number(room.timerEndsAt) - Date.now()) / 1000)
    );

    await incrementPlayerPoints(userID, remainingSeconds, roomID);
    await incrementPlayerPoints(room.currentDrawerID, DRAWER_POINTS_PER_GUESSER, roomID);

    const guesserDetails = get_user_details(userID);
    const guesserRecord = await getPlayer(userID);

    await broadcastToRoom(roomID, {
        type: "PLAYER_GUESSED",
        payload: {
            userID,
            username: guesserDetails ? guesserDetails.username : guesserRecord.username,
            pointsAwarded: remainingSeconds
        }
    });

    const playerOrder = await getPlayerOrder(roomID);
    const requiredGuessers = await getRequiredGuesserCount(playerOrder);
    const guessedCount = await getGuessedCount(roomID);

    if (requiredGuessers > 0 && guessedCount >= requiredGuessers) {
        await endTurn(roomID, "all_guessed");
    }

    return { isCorrectGuess: true, duplicate: false };
};

export const endTurn = async (roomID, reason) => {

    clearRoomTimer(roomID);

    const room = await getRoomHash(roomID);
    const currentState = Number(room.state);

    // Guards against a race where e.g. the timer fires the same tick
    // "everyone guessed" already ended the turn.
    if (currentState === ROUND_END || currentState === GAME_OVER) return;

    await updateRoomFields(roomID, { state: ROUND_END });

    const playerOrder = await getPlayerOrder(roomID);

    await broadcastToRoom(roomID, {
        type: "ROUND_END",
        payload: {
            word: room.currentWord,
            drawerID: room.currentDrawerID,
            reason,
            scores: await buildPlayersWithScores(playerOrder)
        }
    });

    await advanceTurn(roomID);
};

const advanceTurn = async (roomID) => {

    const playerOrder = await getPlayerOrder(roomID);
    const room = await getRoomHash(roomID);

    if (playerOrder.length === 0 || (await getRoomMembers(roomID)).length === 0) {
        await teardownRoom(roomID);
        return;
    }

    // If the drawer just disconnected they have already been removed from the
    // list.  The old index now points at the next player; otherwise advance.
    const storedIndex = Number(room.currentDrawerIndex || 0);
    const currentDrawerStillPresent = playerOrder.includes(room.currentDrawerID);
    let currentDrawerIndex = currentDrawerStillPresent ? storedIndex + 1 : Math.min(storedIndex, playerOrder.length);
    let round = Number(room.round || 1);

    if (currentDrawerIndex >= playerOrder.length) {
        currentDrawerIndex = 0;
        round += 1;
    }

    const maxRounds = Number(room.maxRounds || MAX_ROUNDS);

    if (round > maxRounds) {
        await endGame(roomID);
        return;
    }

    await updateRoomFields(roomID, { currentDrawerIndex, round });

    const handle = setTimeout(() => beginTurn(roomID), ROUND_END_DELAY_MS);
    roomTimers.set(roomID, { type: "round_end_delay", handle });
};

const endGame = async (roomID) => {

    clearRoomTimer(roomID);

    await updateRoomFields(roomID, { state: GAME_OVER });

    const playerOrder = await getPlayerOrder(roomID);
    const scores = await buildPlayersWithScores(playerOrder);

    const winner = scores.reduce(
        (best, player) => (!best || player.points > best.points ? player : best),
        null
    );

    await broadcastToRoom(roomID, {
        type: "GAME_OVER",
        payload: { scores, winner }
    });

    // Usually the close handler performs this immediately.  This covers a
    // game that reached GAME_OVER after its final socket disappeared.
    if ((await getRoomMembers(roomID)).length === 0) await teardownRoom(roomID);
};

// Called from wsManager's socket close handler. Handles the three
// disconnect cases from the spec: drawer, guesser, and (for host
// transfer) the room-level concern is handled in wsManager itself
// since it isn't game-state specific.
export const handleGameDisconnect = async (roomID, userID) => {

    await setPlayerConnected(userID, false, roomID);

    const room = await getRoomHash(roomID);
    const currentState = Number(room.state);

    if (currentState !== WORD_SELECTION && currentState !== PLAYING) return;

    if (room.currentDrawerID === userID) {
        await endTurn(roomID, "drawer_disconnected");
        return;
    }

    if (currentState === PLAYING) {
        const playerOrder = await getPlayerOrder(roomID);
        const requiredGuessers = await getRequiredGuesserCount(playerOrder);
        const guessedCount = await getGuessedCount(roomID);

        if (requiredGuessers <= 0 || guessedCount >= requiredGuessers) {
            await endTurn(roomID, "all_guessed");
        }
    }
};

export const isDrawer = async (roomID, userID) => {

    const room = await getRoomHash(roomID);

    return room.currentDrawerID === userID;
};

export const getGameStateSnapshot = async (roomID) => {

    return await getRoomHash(roomID);
};
