import express from 'express'
import authRoutes from './routes/auth.routes.js'
import cookieParser from 'cookie-parser'

const app = express()

app.use(express.json())
app.use(cookieParser())

app.use('/auth', authRoutes)

app.get('/health', (req, res) =>{
    res.status(200).json({
        status: "ok",
        message: "API funcionando",
    })
})

export default app