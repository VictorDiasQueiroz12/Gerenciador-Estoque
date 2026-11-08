import { Router } from 'express'
import bcrypt from 'bcrypt'
import pool from '../config/database.js'
import jwt from 'jsonwebtoken'
import { authConfig } from '../config/auth.js'
import { requireAuth } from '../middlewares/auth.middlewares.js'


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

router.post('/login', async (req, res) => {
  const {email, password} = req.body ?? {}

  if(typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      message: "E=mail e senha são obrigatórios.",
    })
  }

  const normalizedEmail = email.trim().toLowerCase()

  if(!normalizedEmail || !password){
    return res.status(400).json({
      message: "E-mail e senha são obrigatórios.",
    })
  }

  try{
    const result = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [normalizedEmail])

    const user = result.rows[0]

    if(!user){
      return res.status(401).json({
        message: "E-mail ou senha inválidos.",
      })
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash) //compara a senha ao hash salvo

    if(!passwordMatches){
      return res.status(401).json({
        message: "E-mail ou senha inválidos.",
      })
    }

    const token = jwt.sign //cria um token assinado
    (
      {},
      authConfig.jwtSecret,
      {
        subject: user.id, //identifica o usuario no campo sub do token
        expiresIn: authConfig.jwtExpiresIn,
        algorithm: 'HS256', //define o algoritmo da assinatura
      }
    )

    res.cookie('access_token', token, {
      httpOnly: true, //impede a leitura do cookie pelo JS do navegador
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', //restringe o envio do cookie em alguns acessos vindos de outros sites
      maxAge: 60 * 60 * 1000, //duração do cookie em milessegundos = 1h
      path: '/' //disponibiliza o cookie em todas as rotas da API
    })

    return res.status(200).json({
      message: "Login realizado com sucesso.",
      data:{
        id: user.id,
        name: user.name,
        email: user.email,
      }
    })
  } catch (error){
    console.error("Erro ao realizar login:", error.message)

    return res.status(500).json({
      message: "Não foi possível realizar o login."
    })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try{
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.auth.userId])

    const user = result.rows[0]

    if(!user){
      return res.status(401).json({
        message: "Usuário da sessão não encontrado."
      })
    }

    return res.status(200).json({
      data: user,
    })
  } catch (error) {
    console.error("Erro ao consultar usuário:", error.message)

    return res.status(500).json({
      message: "Não foi possível consultar o usuário."
    })
  } 
})

router.post('/logout', (req, res) =>{
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/', 
  })

  return res.status(200).json({
    message: "Logout realizado com sucesso."
  })
})

router.get('/:marketId/members', requireAuth, async (req, res) => {
  const {marketId} = req.params
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if(!uuidPattern.test(marketId)){
    return res.status(400).json({
      message: "ID do mercado inválido."
    })
  }

  try{
    const result = await pool.query(`SELECT
          u.id AS user_id,
          u.name,
          u.email,
          member.role,
          member.created_at
       FROM market_members AS viewer
       JOIN market_members AS member
         ON member.market_id = viewer.market_id
        AND member.status = 'active'
       JOIN users AS u ON u.id = member.user_id
       WHERE viewer.market_id = $1
         AND viewer.user_id = $2
         AND viewer.status = 'active'
         AND viewer.role IN ('owner', 'admin')
       ORDER BY u.name, u.id`, [marketId, req.auth.userId])

       if(result.rowCount === 0){
        return res.status(403).json({
          message: "Você não tem permissão para consultar a equipe."
        })
       }
       return res.status(200).json({
          data: result.rows
        })
  }catch(error){
    console.error("Erro ao listar membros:", error.message)

    return res.status(500).json({
      message: "Não foi possível consultar a equipe."
    })
  }
})

export default router