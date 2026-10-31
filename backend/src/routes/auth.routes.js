import { Router } from 'express'
import bcrypt from 'bcrypt'
import pool from '../config/database.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { name, email, password, passwordConfirmation } = req.body ?? {}

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof passwordConfirmation !== 'string'
  ) {
    return res.status(400).json({
      message: 'Nome, e-mail, senha e confirmação são obrigatórios.',
    })
  }

  const normalizedName = name.trim() //remove espaços do inicio e fim 
  const normalizedEmail = email.trim().toLowerCase() //transforma em letra minuscula

  if (normalizedName.length < 2 || normalizedName.length > 100) {
    return res.status(400).json({
      message: 'O nome deve ter entre 2 e 100 caracteres.',
    })
  }

  if(
    normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) //Expressão Regular (Regex) usada para validar endereços de e-mail
  ) {
    return res.status(400).json({
      message: "Informe um e-mail válido.",
    })
  }

  if(password.length < 8 || Buffer.byteLength(password, "utf8") > 72) //mede quantos bytes o texto ocupa
   {
    return res.status(400).json({
      message: "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.",
    })
  }

  if(password !== passwordConfirmation) {
    return res.status(400).json({
      message: "As senhas não conferem.",
    })
  }

  try{
    const passwordHash = await bcrypt.hash(password, 12)

    const result = await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at', [normalizedName, normalizedEmail, passwordHash])

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso.",
      data: result.rows[0],
    })
  } catch (error) {
    if(error.code === '23505') {
      return res.status(409).json({
        message: "Este e-mail já está cadastrado."
      })
    }

    console.error("Erro ao cadastrar usuário:", error.message)

    return res.status(500).json({
      message: "Não foi possível cadastrar o usuário."
    })
  }
})

export default router