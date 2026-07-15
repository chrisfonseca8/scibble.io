import ExpressError from "../utils/error_handler/ExpressError.js";
import { room_creation_redis, room_join_redis } from '../services/room_service/room_service.js';

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;

const validateUsername = (username) => {

    if (username === undefined || username === null) {
        throw new ExpressError("Username is required.", 400);
    }

    if (typeof username !== "string") {
        throw new ExpressError("Username must be a string.", 400);
    }

    username = username.trim();

    if (username.length === 0) {
        throw new ExpressError("Username cannot be empty.", 400);
    }

    if (username.length < MIN_USERNAME_LENGTH) {
        throw new ExpressError(
            `Username must be at least ${MIN_USERNAME_LENGTH} characters long.`,
            400
        );
    }

    if (username.length > MAX_USERNAME_LENGTH) {
        throw new ExpressError(
            `Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`,
            400
        );
    }

    return username;
};

const validateRoomID = (roomID) => {

    if (roomID === undefined || roomID === null) {
        throw new ExpressError("Room ID is required.", 400);
    }

    if (typeof roomID !== "string") {
        throw new ExpressError("Room ID must be a string.", 400);
    }

    roomID = roomID.trim();

    if (roomID.length === 0) {
        throw new ExpressError("Room ID cannot be empty.", 400);
    }

    return roomID;
};

export const createRoom_controller = async (req, res, next) => {
    try {

        const username = validateUsername(req.body.username);
        const roomResult = await room_creation_redis(username);

        if (!roomResult.status) {
            throw new ExpressError(roomResult.message, 500);
        }

        const { userID, roomID } = roomResult.data;

        // This was the fatal one: the old version just `return`ed
        // this object instead of sending it, so the client's fetch()
        // to /createRoom would hang until it timed out.
        return res.status(200).json({
            status: true,
            message: "Room created successfully.",
            data: { userID, roomID }
        });
    }
    catch (error) {
        next(error);
    }
};

export const joinRoom_controller = async (req, res, next) => {
    try {

        console.log("join room controller is hit ")

        // username isn't used by room_join_redis itself (nothing gets
        // written to Redis for it here), but it's validated up front
        // anyway since the frontend needs a good username in hand
        // before it opens the socket and sends JOIN_ROOM.
        validateUsername(req.body.username);
        const roomID = validateRoomID(req.body.roomID);

        const joinResult = await room_join_redis(roomID);

        if (!joinResult.status) {
            console.log(joinResult)
            throw new ExpressError(joinResult.message, 400);
        }

        const { userID } = joinResult.data;

        return res.status(200).json({
            status: true,
            message: "Joined room successfully.",
            data: { userID, roomID }
        });
    }
    catch (error) {
        next(error);
    }
};