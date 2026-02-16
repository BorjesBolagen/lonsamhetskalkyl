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

let lastMessage = {
  message: 'No messages yet.',
  sentAt: ''
}

// Standard route för test, health check
app.get('/', (req, res) => {
  res.type('html').send(`
    <html>
      <head><title>Backend</title></head>
      <body style="font-family: sans-serif; padding: 24px;">
        <h1>Backend server is running</h1>
        <p><strong>Last message from frontend:</strong> ${lastMessage.message}</p>
        <p><strong>Time:</strong> ${lastMessage.sentAt || 'N/A'}</p>
      </body>
    </html>
  `)
})

app.post('/api/message', (req, res) => {
  const { message, sentAt } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' })
  }

  const timeValue = typeof sentAt === 'string' ? sentAt : ''
  lastMessage = { message, sentAt: timeValue }
  return res.json({ received: message, sentAt: timeValue })
})

// Startar servern på den port som anges i miljövariablerna eller 5000 som default
const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
