import express from 'express'

const router = express.Router()

import {createRoom_controller} from '../controllers/room_controllers.js'


router.post('/createRoom',createRoom_controller)


export default router