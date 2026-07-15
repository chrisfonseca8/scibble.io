import { v4 as uuidv4 } from "uuid";
import redis from "../../redis/config.js";

import { states } from "../../utils/common/states.js";
const {IN_GAME,CLOSED,READY,WAITING} = states

import {add_newRoom_user_info,roomID_userID_track} from '../redis_service/redis_service.js'

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

        const memberResponse = await roomID_userID_track(
            roomID,
            userID
        );

        if (!memberResponse.status) {
            return memberResponse;
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