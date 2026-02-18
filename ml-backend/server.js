import http from 'node:http'

const PORT = process.env.PORT || 5050

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'ml-backend' }))
    return
  }

  if (req.method === 'POST' && req.url === '/api/ml') {
    try {
      await readJsonBody(req)
      res.writeHead(501, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: 'Not implemented',
          message: 'ML service placeholder for future heavy calculations.'
        })
      )
      return
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`ML backend listening on port ${PORT}`)
})
