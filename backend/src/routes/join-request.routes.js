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
    }
})