import redis from "../../redis/config.js";
import { states } from "../../utils/common/states.js";

const { WAITING, CLOSED } = states;

export const add_newRoom_user_info = async (roomID, userID, username) => {

    const roomKey = `room:${roomID}`;
    const memberKey = `room:${roomID}:members`;

    await redis
        .multi()
        .hset(roomKey, {
            hostID: userID,
            hostName: username,
            limit: 8,
            state: WAITING,
            visibility: "PRIVATE",
            created_at: Date.now(),
        })
        .sadd(memberKey, userID)
        .exec();

    return {
        status: true,
        message: "entry made to redis",
        data: { roomID, userID }
    };
};

// Used when a user joins a room that already exists (not the creator).
// NOTE: room creation does NOT call this — add_newRoom_user_info already
// adds the host to the members set as part of its own transaction.
// Calling both for the same user was writing the same member twice.
export const roomID_userID_track = async (roomID, userID) => {

    const key = `room:${roomID}:members`;

    await redis.sadd(key, userID);

    return {
        status: true,
        message: "User added to room.",
    };

    console.log(await redis.smembers(key))
    console.trace("roomID_userID_track was called here ")
};

export const getRoomMembers = async (roomID) => {

    const memberKey = `room:${roomID}:members`;

    return await redis.smembers(memberKey);
};


export const getRoomState = async (roomID) => {

    const roomKey = `room:${roomID}`;

    return await redis.hget(roomKey, "state");
};

export const getRoomLimit = async (roomID) => {
    const roomKey = `room:${roomID}`;

    return await redis.hget(roomKey, "limit");
};

export const updateRoomState = async (roomID, state) => {
    const roomKey = `room:${roomID}`;

    await redis.hset(roomKey, "state", state);

};


export const removeMember = async (roomID, userID) => {

    const memberKey = `room:${roomID}:members`;

    // Remove the user from the room
    await redis.srem(memberKey, userID);

    // Get the current room state
    const state = Number(await getRoomState(roomID));

    // If the room isn't CLOSED, there's nothing to do.
    // This prevents PLAYING, ROUND_END, GAME_END, etc.
    // from accidentally being changed back to WAITING.
    if (state !== CLOSED) {
        return;
    }

    // Get the current number of members
    const members = await getRoomMembers(roomID);

    // Get the room limit
    const limit = Number(await getRoomLimit(roomID));

    // If the room is no longer full, reopen it.
    if (members.length < limit) {
        await updateRoomState(roomID, WAITING);
    }
};

export const checkRoomExists = async (roomID) => {

    const roomKey = `room:${roomID}`;

    const exists = await redis.exists(roomKey);

    return !!exists;
};



export const checkRedis = async (userID, roomID) => {

    try {

        const roomKey = `room:${roomID}`;
        const memberKey = `room:${roomID}:members`;

        const roomExists = await redis.exists(roomKey);

        if (!roomExists) {
            return {
                status: false,
                message: "Room does not exist."
            };
        }

        const isMember = await redis.sismember(memberKey, userID);

        if (!isMember) {
            return {
                status: false,
                message: "User does not belong to this room."
            };
        }

        return {
            status: true,
            message: "Room and user verified."
        };

    } catch (error) {

        console.error(error);

        return {
            status: false,
            message: "Redis verification failed."
        };

    }

};

export const updateRoomLimit = async (roomID, limit) => {
    const roomKey = `room:${roomID}`;

    await redis.hset(roomKey, "limit", limit);
};

export const update_redis_limit = async (limit, roomID) => {

    limit = Number(limit);
    roomID = Number(roomID);

    // Update the limit in Redis
    await updateRoomLimit(roomID, limit);

    // Get the current number of members
    const members = await getRoomMembers(roomID);

    // Update the room state accordingly
    if (members.length >= limit) {
        await updateRoomState(roomID, CLOSED);
    } else {
        await updateRoomState(roomID, WAITING);
    }
};

/* ------------------------------------------------------------------ */
/* Game logic layer additions below.                                  */
/* Everything above this line is the pre-existing lobby/room service. */
/* ------------------------------------------------------------------ */

// Fixed turn-order list, per the spec: room:{roomID}:players (LIST),
// separate from room:{roomID}:members (SET, used by the existing lobby
// broadcast code). Populated as players join; never reordered.
// lpos guards against double-adding the same userID on a reconnect
// that re-sends JOIN_ROOM for a player already in the list.
export const addPlayerToOrder = async (roomID, userID) => {

    const key = `room:${roomID}:players`;

    const existingIndex = await redis.lpos(key, userID);

    if (existingIndex !== null) return;

    await redis.rpush(key, userID);

    console.log("room-roomid-players", await redis.lrange(key, 0, -1));
    console.trace("room-roomid-players was shown here")

};

export const getPlayerOrder = async (roomID) => {

    const key = `room:${roomID}:players`;

    return await redis.lrange(key, 0, -1);
};

// player:{userID} HASH — username/points/roomID/connected, per spec.
export const createPlayerHash = async (userID, username, roomID) => {

    const key = `player:${userID}`;

    // Only set points to 0 the first time so a reconnecting player
    // doesn't have their score wiped mid-game.
    const exists = await redis.exists(key);

    if (exists) {
        await redis.hset(key, { username, roomID, connected: "true" });
        return;
    }

    await redis.hset(key, {
        username,
        points: 0,
        roomID,
        connected: "true"
    });

    console.log("players:userID", await redis.hgetall(key));
    console.trace("players:userID was shown here")

};

export const getPlayer = async (userID) => {

    const key = `player:${userID}`;

    return await redis.hgetall(key);
};

export const setPlayerConnected = async (userID, connected) => {

    const key = `player:${userID}`;

    await redis.hset(key, "connected", connected ? "true" : "false");
};

export const incrementPlayerPoints = async (userID, amount) => {

    const key = `player:${userID}`;

    await redis.hincrby(key, "points", amount);
};

// Full room hash — used to read the FSM's current game fields
// (currentWord, currentDrawerID, round, timerEndsAt, etc).
export const getRoomHash = async (roomID) => {

    const key = `room:${roomID}`;

    return await redis.hgetall(key);
};

export const updateRoomFields = async (roomID, fields) => {

    const key = `room:${roomID}`;

    await redis.hset(key, fields);

    console.log(await redis.hgetall(key))
    console.trace(`here this is the updated room:${roomID}`)
};

// room:{roomID}:guessed SET — only exists during a single turn.
export const clearGuessed = async (roomID) => {

    const key = `room:${roomID}:guessed`;

    await redis.del(key);
};

export const addGuessed = async (roomID, userID) => {

    const key = `room:${roomID}:guessed`;

    await redis.sadd(key, userID);
};

export const isGuessed = async (roomID, userID) => {

    const key = `room:${roomID}:guessed`;

    const result = await redis.sismember(key, userID);

    return result === 1;
};

export const getGuessedCount = async (roomID) => {

    const key = `room:${roomID}:guessed`;

    return await redis.scard(key);
};