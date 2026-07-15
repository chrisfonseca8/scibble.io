import express from 'express'
const router = express.Router()
import roomRoutes from './roomRoutes.js'

router.use('/',roomRoutes)

export default router 
