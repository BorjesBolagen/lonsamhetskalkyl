import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import calcRoutes from './routes/calc.js'

dotenv.config() // Ladda in .evn filen så vi kan använda miljövariabler

// Skapar express-appen
const app = express()
app.use(express.json())

// Konfigurera CORS för frontend-anslutning
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
app.use(cors(corsOptions))

// Koppla routes
app.use('/api/auth', authRoutes)
app.use('/api/calc', calcRoutes)

// Standard route för test, health check
app.get('/', (req, res) => {
  res.send('Backend server is running')
})

// Startar servern på den port som anges i miljövariablerna eller 5000 som default
const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
