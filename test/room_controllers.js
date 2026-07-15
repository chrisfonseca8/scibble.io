import ExpressError from "../utils/error_handler/ExpressError.js";
import { room_creation_redis } from '../services/room_service/room_service.js'

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




export const createRoom_controller = async (req, res, next) => {
    try {

        const username = validateUsername(req.body.username);
        const { userID, roomID } = (await room_creation_redis(username)).data;

        return {
            status: true,
            message: "sussfully entered redis data ",
            data: { userID, roomID }
        }
    }
    catch (error) {
        next(error);
    }
};


