import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import calcRoutes from './routes/calc.js'
import { supabase } from './lib/supabaseClient.js'

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

app.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('message, sent_at')
      .order('id', { ascending: false })
      .limit(1)
      .single()

    const lastMessage = error || !data ? { message: 'No messages yet.', sent_at: '' } : data
    const displayTime = lastMessage.sent_at || 'N/A'

    res.type('html').send(`
      <html>
        <head><title>Backend</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>Backend server is running</h1>
          <p><strong>Last message from frontend:</strong> ${lastMessage.message}</p>
          <p><strong>Time:</strong> ${displayTime}</p>
        </body>
      </html>
    `)
  } catch (err) {
    res.type('html').send(`
      <html>
        <head><title>Backend</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>Backend server is running</h1>
          <p style="color: red;">Error connecting to database</p>
        </body>
      </html>
    `)
  }
})

app.post('/api/message', (req, res) => {
  const { message, sentAt } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' })
  }

  const timeValue = typeof sentAt === 'string' ? sentAt : ''
  
  supabase
    .from('messages')
    .insert([{ message, sent_at: timeValue }])
    .then(() => {
      res.json({ received: message, sentAt: timeValue })
    })
    .catch(() => {
      res.status(500).json({ error: 'Failed to save message' })
    })
})

// Startar servern på den port som anges i miljövariablerna eller 5000 som default
const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
