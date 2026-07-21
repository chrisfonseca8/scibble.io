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

import { broadcastToRoom, get_user_details, sendJsonToUser } from '../../ws/wsManager.js';

const { WORD_SELECTION, PLAYING, ROUND_END, GAME_OVER } = states;

const MAX_ROUNDS = 6;                   
const WORD_OPTIONS_COUNT = 3;          
const DRAWER_POINTS_PER_GUESSER = 50;
const TURN_DURATION_SECONDS = 80;      
const WORD_SELECTION_GRACE_MS = 15000; 
const ROUND_END_DELAY_MS = 5000;       


const roomTimers = new Map();


const pendingWordOptions = new Map();

const activeGameRooms = new Set();

const isGameRoomLive = async (roomID) => {
    if (!activeGameRooms.has(roomID)) return false;
    return (await getRoomMembers(roomID)).length > 0;
};

export const clearRoomTimer = (roomID) => {

    const existing = roomTimers.get(roomID);

    if (!existing) return;

    clearTimeout(existing.handle);
    roomTimers.delete(roomID);
};


export const teardownRoom = async (roomID, additionalUserIDs = []) => {
    activeGameRooms.delete(roomID);
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


const getRequiredGuesserCount = async (playerOrder) => {

    const connected = await getConnectedPlayerCount(playerOrder);

    return Math.max(0, connected - 1);
};

export const startGame = async (roomID) => {

    const playerOrder = await getPlayerOrder(roomID);//gets a list of userID beloning  to the roomID
 

    if (playerOrder.length < 2) {
        return { status: false, message: "Need at least 2 players to start." };
    }

    if ((await getRoomMembers(roomID)).length === 0) {
        await teardownRoom(roomID);
        return { status: false, message: "Room is empty." };
    }

    activeGameRooms.add(roomID);

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

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    const playerOrder = await getPlayerOrder(roomID);


    if (playerOrder.length === 0 || (await getRoomMembers(roomID)).length === 0) {
        await teardownRoom(roomID);
        return;
    }

    const room = await getRoomHash(roomID);

    const drawerIndex = Number(room.currentDrawerIndex || 0) % playerOrder.length;
    const drawerID = playerOrder[drawerIndex];


    // Guessed set only exists during a turn — wiped at the start of
    // every one, per spec.
    await clearGuessed(roomID);

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    await updateRoomFields(roomID, {
        state: WORD_SELECTION,
        currentDrawerID: drawerID,
        currentWord: "",
        currentWordLength: 0
    });

    // The final socket can close while the Redis write above is pending.
    // Re-check before creating word options or emitting any turn message.
    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    const options = getWordOptions(WORD_OPTIONS_COUNT);
    pendingWordOptions.set(roomID, options);





  
    const drawerDetails = get_user_details(drawerID);

    const drawerRecord = await getPlayer(drawerID);

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

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

    // Look up the live socket again instead of using the saved reference. A
    // close event deletes the mapping synchronously, so this cannot send a
    // stale WORD_OPTIONS message after teardown.
    if (await isGameRoomLive(roomID)) {
        console.log("SENDING WORD_OPTIONS");
        console.log(options);
        sendJsonToUser(drawerID, {
            type: "WORD_OPTIONS",
            payload: { options }
        });
    }

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }



    // Drawer disconnecting is handled immediately elsewhere (see
    // handleDisconnect below) — this timeout only covers a connected
    // drawer who simply never picks a word.
    const handle = setTimeout(() => autoSelectWord(roomID), WORD_SELECTION_GRACE_MS);
    roomTimers.set(roomID, { type: "word_selection", handle });
};

const startPlaying = async (roomID, word) => {

    clearRoomTimer(roomID);

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }
    const timerEndsAt = Date.now() + TURN_DURATION_SECONDS * 1000;

    await updateRoomFields(roomID, {
        state: PLAYING,
        currentWord: word,
        currentWordLength: word.length,
        timerEndsAt
    });

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

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
    if (await isGameRoomLive(roomID)) {
        const sent = sendJsonToUser(room.currentDrawerID, { type: "DRAW_WORD", payload: { word } });
        if (!sent) {
            console.warn(`Failed to send DRAW_WORD to drawer ${room.currentDrawerID} - drawer not connected or not found`);
        }
    }

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    const handle = setTimeout(() => endTurn(roomID, "timeout"), TURN_DURATION_SECONDS * 1000);
    roomTimers.set(roomID, { type: "playing", handle });
};

const autoSelectWord = async (roomID) => {

    if (!(await isGameRoomLive(roomID))) return;

    const room = await getRoomHash(roomID);

    if (Number(room.state) !== WORD_SELECTION) return;

    const options = pendingWordOptions.get(roomID);

    if (!options || options.length === 0) return;

    pendingWordOptions.delete(roomID);

    await startPlaying(roomID, options[0]);
};

export const selectWord = async (roomID, userID, word) => {

    if (!(await isGameRoomLive(roomID))) {
        return { status: false, message: "Room is no longer active." };
    }

    const room = await getRoomHash(roomID);

    if (!(await isGameRoomLive(roomID))) {
        return { status: false, message: "Room is no longer active." };
    }

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


export const handleGuess = async (roomID, userID, text) => {

    if (!(await isGameRoomLive(roomID))) return { isCorrectGuess: false };

    const room = await getRoomHash(roomID);

    if (!(await isGameRoomLive(roomID))) return { isCorrectGuess: false };

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

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return { isCorrectGuess: false };
    }

    const remainingSeconds = Math.max(
        0,
        Math.round((Number(room.timerEndsAt) - Date.now()) / 1000)
    );

    await incrementPlayerPoints(userID, remainingSeconds, roomID);
    await incrementPlayerPoints(room.currentDrawerID, DRAWER_POINTS_PER_GUESSER, roomID);

    const guesserDetails = get_user_details(userID);
    const guesserRecord = await getPlayer(userID);

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return { isCorrectGuess: false };
    }

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

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    const room = await getRoomHash(roomID);
    const currentState = Number(room.state);

    // Guards against a race where e.g. the timer fires the same tick
    // "everyone guessed" already ended the turn.
    if (currentState === ROUND_END || currentState === GAME_OVER) return;

    await updateRoomFields(roomID, { state: ROUND_END });

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

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

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    const playerOrder = await getPlayerOrder(roomID);
    const room = await getRoomHash(roomID);

    if (playerOrder.length === 1 || (await getRoomMembers(roomID)).length === 1) {
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

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

    await updateRoomFields(roomID, { state: GAME_OVER });

    if (!(await isGameRoomLive(roomID))) {
        await teardownRoom(roomID);
        return;
    }

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


    if ((await getRoomMembers(roomID)).length === 0) await teardownRoom(roomID);
};


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
