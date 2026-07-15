import redis from "../../redis/config"

export const add_newRoom_user_info = async(roomID, userID, username) => {

    await redis
        .multi()
        .hSet(roomKey, {
            roomID: roomID,
            hostID: userID,
            host_name: username,
            state: WAITING,
            visibility: "PRIVATE",
            created_at: Date.now(),
        })
        .sAdd(memberKey, userID)
        .exec();

    return {
        status:true,
        message:"entry made to redis",
        data:{roomID,userID}
    }
}


export const roomID_userID_track = async (roomID, userID) => {

    const key = `room:${roomID}:members`;

    await redis.sAdd(key, userID);

    return {
        status: true,
        message: "User added to room.",
    };

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

        // const isMember = await redis.sIsMember(memberKey, userID);

        // if (!isMember) {
        //     return {
        //         status: false,
        //         message: "User does not belong to this room."
        //     };
        // }

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