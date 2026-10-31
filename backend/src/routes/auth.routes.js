import { Router } from 'express'

const router = Router()

router.post('/register', (req, res) => {
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

  return res.status(200).json({
    message: "Dados válidos. O cadastro ainda não foi salvo.",
    data: {
      name: normalizedName,
      email: normalizedEmail,
    },
  })
})

export default router