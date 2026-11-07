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

router.get('/', requireAuth, async (req, res) => {
    try{
        const result = await pool.query(`SELECT
          markets.id,
          markets.name,
          market_members.role
       FROM markets
       JOIN market_members
         ON market_members.market_id = markets.id
       WHERE market_members.user_id = $1
         AND market_members.status = 'active'
       ORDER BY markets.name, markets.id`, [req.auth.userId])

       return res.status(200).json({
        data: result.rows,
       })
    } catch (error){
        console.error("Erro ao listar mercados:", error.message)

        return res.status(500).json({
            message: "Não foi possível listar os mercados."
        })
    }
})

router.get('/:marketId/join-requests', requireAuth, async (req, res) => {
    const {marketId} = req.params

    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(marketId)){
        return res.status(400).json({
            message: "ID do mercado inválido."
        })
    }

    try{
        const memberResult = await pool.query(`SELECT role FROM market_members WHERE market_id = $1 AND user_id = $2 AND status = 'active'`,[marketId, req.auth.userId])

        const member = memberResult.rows[0]

        if(!member || !['owner', 'admin'].includes(member.role)){
            return res.status(403).json({
                message: "Você não tem permissão para consultar as solicitações."
            })
        }

        const result = await pool.query(`SELECT
          join_requests.id,
          join_requests.user_id,
          users.name,
          users.email,
          join_requests.status,
          join_requests.created_at
       FROM join_requests
       JOIN users ON users.id = join_requests.user_id
       WHERE join_requests.market_id = $1
         AND join_requests.status = 'pending'
       ORDER BY join_requests.created_at, join_requests.id`, [marketId])

       return res.status(200).json({
        data: result.rows,
       })
    }catch(error){
        console.error("Erro ao listar solicitações: ", error.message)

        return res.status(500).json({
            message: "Não foi possível listar as solicitações."
        })
    }
})

router.patch('/:marketId/join-requests/:requestId', requireAuth ,async (req, res) => {
    const{marketId, requestId} = req.params
    const {status} = req.body ?? {}

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if(!uuidPattern.test(marketId) || !uuidPattern.test(requestId)){
        return res.status(400).json({
            message: "ID do mercado ou da solicitação inválido."
        })
    }

    if(!['approved', 'rejected'].includes(status)){
        return res.status(400).json({
            message: "Informe approved ou rejected."
        })
    }

    let client

    try{
        client = await pool.connect()
        await client.query('BEGIN')

        const marketResult = await pool.query('SELECT id FROM markets WHERE id = $1 FOR UPDATE', [marketId])

        const memberResult = await pool.query(`SELECT role FROM market_members WHERE market_id = $1 AND user_id = $2 AND status = 'active'`, [marketId, req.auth.userId])

        const reviwer = memberResult.rows[0]

        if(!marketResult.rowCount || !reviwer || !['owner', 'admin'].includes(reviwer.roles)){
            await client.query('ROLLBACK')

            return res.status(403).json({
                message: "Você não tem permissão para analisar solicitações."
            })
        }

        const requestResult = await client.query('SELECT id, user_id, status FROM join_requests WHERE id = $1 AND market_id = $2 FOR UPDATE', [requestId, marketId])

        const joinRequest = requestResult.rows[0]

        if(!joinRequest){
            await client.query('ROLLBACK')

            return res.status(404).json({
                message: "Solicitação não encontrada."
            })
        }

        if(joinRequest.status !== 'pending'){
            await client.query('ROLLBACK')

            return res.status(409).json({
                message: "Esta solicitação já foi analisada."
            })
        }

        if (status === 'approved') {
        const membershipResult = await client.query(
        `INSERT INTO market_members (market_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (market_id, user_id) DO UPDATE SET role = 'member', status = 'active', updated_at = CURRENT_TIMESTAMP WHERE market_members.status IN ('removed', 'left') RETURNING id`, [marketId, joinRequest.user_id]);

        if (!membershipResult.rowCount) {
        await client.query('ROLLBACK');

        return res.status(409).json({
            message: "O usuário já está ativo ou está banido."});
            }   
        }

        const result = await client.query(`UPDATE join_requests SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3 AND market_id = $4 RETURNING id, market_id, user_id, status, reviewed_at`, [status, req.auth.userId, requestId, marketId])

        await client.query('COMMIT')

        return res.status(200).json({
            message:
                status === 'aproved'
                ? "Solicitação aprovada."
                : "Solicitação recusada.",
            data: result.rows[0]
        })
    }catch(error){
        if(client){
            try{
                await client.query('ROLLBACK')
            }catch(rollbackError){
                console.error("Erro no rollback:", rollbackError.message)
            }
        }

        console.error("Erro ao analisar solicitação:", error.message)

        return res.status(500).json({
            message: "Não foi possível analisar a solicitação."
        })
    }finally{
        client?.release()
    }
})

export default router