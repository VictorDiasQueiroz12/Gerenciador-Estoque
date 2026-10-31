import 'dotenv/config'

const jwtSecret = process.env.JWT_SECRET

if(!jwtSecret || jwtSecret.length < 64) {
    throw new Error(
        "Configure JWT_SECRET no .env com a chave hexadecimal gerada."
    )
}

export const authConfig = {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN
|| '1H',
}