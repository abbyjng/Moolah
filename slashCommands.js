const https = require('https')
const auth = require('./auth.json');

const data = JSON.stringify(
  {
    "name": "cleartransactions",
    "description": "Clear all transactions associated with this server."
  }
  
)

const options = {
  hostname: 'discord.com',
  port: 443,
  path: '/api/v8/applications/839639502767259669/commands',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': "Bot " + auth.token
  }
}

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`)

  res.on('data', d => {
    process.stdout.write(d)
  })
})

req.on('error', error => {
  console.error(error)
})

req.write(data)
req.end()