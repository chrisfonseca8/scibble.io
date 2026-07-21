import { v4 as uuidv4 } from "uuid";
import redis from "../../redis/config.js";

import { states } from "../../utils/common/states.js";
const { IN_GAME, CLOSED, READY, WAITING } = states;

import {
    add_newRoom_user_info,
    roomID_userID_track,
    checkRoomExists,
    getRoomState,
    getRoomLimit,
    updateRoomState,
    getRoomMembers
} from '../redis_service/redis_service.js';

export const room_creation_redis = async (username) => {
    try {

        const userID = uuidv4();
        const roomID = uuidv4();


        const roomResponse = await add_newRoom_user_info(
            roomID,
            userID,
            username
        );

        if (!roomResponse.status) {
            return roomResponse;
        }

        return {
            status: true,
            message: "Redis data inserted successfully.",
            data: {
                userID,
                roomID
            }
        };

    } catch (error) {

        console.error(error);

        return {
            status: false,
            message: "Failed to create room in Redis."
        };

    }
};

export const room_join_redis = async (roomID) => {
    try {

        const roomExists = await checkRoomExists(roomID);

        if (!roomExists) {
            return {
                status: false,
                message: "Room does not exist."
            };
        }

        const roomState = await getRoomState(roomID);

        if (Number(roomState) !== WAITING) {
            return {
                status: false,
                message: "This room is no longer accepting players."
            };
        }

        const limit = Number(await getRoomLimit(roomID));

        const members = await getRoomMembers(roomID);
    

        // Room already full
        if (Number(members.length) >= limit) {
            return {
                status: false,
                message: "Room is full."
            };
        }

        const userID = uuidv4();

        const memberResponse = await roomID_userID_track(roomID, userID);

        if (!memberResponse.status) {
            return memberResponse;
        }

        // Check if the room became full after joining
        const updatedMembers = await getRoomMembers(roomID);

        if (updatedMembers.length === limit) {
            await updateRoomState(roomID, CLOSED);
        }

        return {
            status: true,
            message: "Joined room successfully.",
            data: {
                userID,
                roomID
            }
        };

    } catch (error) {

        console.error(error);

        return {
            status: false,
            message: "Failed to join room in Redis."
        };
    }
};