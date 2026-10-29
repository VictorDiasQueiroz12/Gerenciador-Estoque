import { Router } from 'express'

const router = Router()

router.post('/register', (req, res) => {
  const { name, email, password, passwordConfirmation } = req.body ?? {};

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof passwordConfirmation !== 'string'
  ) {
    return res.status(400).json({
      message: 'Nome, e-mail, senha e confirmação são obrigatórios.',
    });
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedName.length < 2 || normalizedName.length > 100) {
    return res.status(400).json({
      message: 'O nome deve ter entre 2 e 100 caracteres.',
    });
  }


})