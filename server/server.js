require('dotenv').config()

const app = require('./app')
const { testConnection } = require('./config/database')

const PORT = process.env.PORT || 5000

async function start() {
  try {
    await testConnection()
    console.log('Database connected successfully.')
  } catch (error) {
    console.error('Database connection failed:', error.message)
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`)
  })
}

start()
