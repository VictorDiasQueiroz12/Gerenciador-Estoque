import jwt from 'jsonwebtoken'
import { authConfig } from '../config/auth'

export function requireAuth(req, res, next) {
    const token = req.cookies?.access_token

    if(!token){
        return res.status(401).json({
            message: "Faça login para continuar."
        })
    }

    try{
        const payload = jwt.verify(token, authConfig.jwtSecret, {
            algorithms: ['HS256'],
        })

        if(typeof payload.sub !== 'string'){
            return res.status(401).json({
                message: "Sessão inválida.",
            })
        }

        req.auth = {
            userId: payload.sub,
        }

        return next()
    } catch {
        return res.status(401).json({
            message: "Sessão inválida ou expirada. Faça login novamente."
        })
    }
}