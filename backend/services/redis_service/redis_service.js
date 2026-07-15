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