import { Router } from "express"
import { randomBytes, createHash } from 'node:crypto'
import pool from "../config/database.js"
import { requireAuth } from "../middlewares/auth.middlewares.js"
import { findPackageJSON } from "node:module"

const router = Router()

router.post('/', requireAuth, async (req, res) => {
    const {name} = req.body ?? {}

    if(typeof name !== 'string'){
        return res.status(400).json({
            message: "O nome do mercado é obrigatório.",
        })
    }

    const normalizedName = name.trim()

    if(normalizedName.length < 2 || normalizedName.length > 100){
        return res.status(400).json({
            message: "O nome deve ter entre 2 a 100 caracteres."
        })
    }

    const accessCode = randomBytes(16).toString('hex') //gera um codigo aleatorio de 32 caracteres hexadecimais

    const accessCodeHash = createHash('sha256') //gera a representação do codigo que sera salva
        .update(accessCode)
        .digest('hex')
    
    let client

    try{
        client = await pool.connect() //faz com que todas as transações precisem usar o mesmo client

        await client.query('BEGIN') //inicia a transação

        const result = await client.query('INSERT INTO markets (name, access_code_hash) VALUES ($1, $2) RETURNING id, name, created_at', [normalizedName, accessCodeHash])

        const market = result.rows[0]

        await client.query('INSERT INTO market_members (market_id, user_id, role) VALUES ($1, $2, $3)', [market.id, req.auth.userId, 'owner'])

        await client.query('COMMIT') //confirma duas gravações

        return res.status(201).json({
            message: "Mercado criado com sucesso.",
            data: {
                ...market, //copia as propriedades de market para a resposta
                role: 'owner',
                accessCode,
            }
        })
    } catch (error) {
        if(client){
            try{
                await client.query('ROLLBACK') //desfaz as gravações se der erro
            } catch (rollbackError) {
                console.error("Erro ao desfazer transação:", rollbackError.message)
            }
        }

        console.error("Erro ao criar mercado:", error.message)

        return res.status(500).json({
            message: "Não foi possível criar o mercado."
        })
    } finally {
        client?.release()
    }
})

export default router