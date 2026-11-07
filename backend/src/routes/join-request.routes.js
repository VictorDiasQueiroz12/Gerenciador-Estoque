import { Router } from "express"
import { createHash } from 'node:crypto'
import pool from "../config/database.js"
import { requireAuth } from "../middlewares/auth.middlewares.js"

const router = Router()

router.post('/', requireAuth, async (req, res) => {
    const {accessCode} = req.body ?? {}

    if(typeof accessCode !== 'string'){
        return res.status(400).json({
            message: "Informe o código de acesso.",
        })
    }

    const normalizedCode = accessCode.trim().toLowerCase()

    if(!/^[a-f0-9]{32}$/.test(normalizedCode)){
        return res.status(400).json({
            message: "Código de acesso inválido."
        })
    }

    const codeHash = createHash('sha256')
        .update(normalizedCode)
        .digest('hex')

    try{
        const marketResult = await pool.query('SELECT id FROM markets WHERE access_code_hash = $1', [codeHash])

        const market = marketResult.rows[0]

        if(!market){
            return res.status(400).json({
                message: "Código de acesso inválido.",
            })
        }

        const memberResult = await pool.query('SELECT status FROM market_members WHERE market_id = $1 AND user_id = $2', [market.id, req.auth.userId])

        const member = memberResult.rows[0]

        if(member?.status === 'banned'){
            return res.status(403).json({
                message: "Você não pode solicitar acesso a este mercado."
            })
        }

        if(member?.status === 'active'){
            return res.status(409).json({
                message: "Você já participa deste mercado."
            })
        }

        //ON CONFLICT ... DO NOTHING usa o índice único que criamos: se já houver uma solicitação pendente, não insere outra. Nesse caso, rowCount será zero.
        const result = await pool.query(`INSERT INTO join_requests (market_id, user_id) VALUES ($1, $2) ON CONFLICT (market_id, user_id) WHERE status = 'pending' DO NOTHING RETURNING id, market_id, status, created_at`, [market.id, req.auth.userId])

        if(result.rowCount === 0){
            return res.status(409).json({
                message: "Você já tem uma solicitação pendente neste mercado."
            })
        }

        return res.status(201).json({
            message: "Solicitação enviada. Aguarde aprovação.",
            data: result.rows[0],
        })
    }catch(error){
        console.error("Erro ao solicitar acesso:", error.message)

        return res.status(500).json({
            message: "Não foi possível solicitar acesso."
        })
    }
})

router.get("/me", requireAuth, async (req, res) => {
    try{
        const result = await pool.query(`SELECT
          jr.id,
          jr.market_id,
          m.name AS market_name,
          jr.status,
          jr.created_at,
          jr.reviewed_at
       FROM join_requests AS jr
       JOIN markets AS m ON m.id = jr.market_id
       WHERE jr.user_id = $1
       ORDER BY jr.created_at DESC, jr.id`, [req.auth.userId])

       return res.status(200).json({
        data: result.rows
       })
    }catch(error){
        console.error("Erro ao consultar minhas solicitações:", error.message)

        return res.status(500).json({
            message: "Não foi possível consultar suas solicitações."
        })
    }
})

export default router