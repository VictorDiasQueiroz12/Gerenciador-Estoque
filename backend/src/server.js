import 'dotenv/config'
import app from './app.js'
import pool from './config/database.js'

const port = process.env.PORT || 3001

async function startServer() {
  try {
    await pool.query('SELECT 1')

    console.log('Conexão com o PostgreSQL estabelecida.')

    app.listen(port, () => {
      console.log(`Servidor disponível em http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Erro ao conectar ao PostgreSQL:', error.message)

    await pool.end();
    process.exitCode = 1
  }
}

startServer()