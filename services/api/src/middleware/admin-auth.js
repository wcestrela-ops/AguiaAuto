function adminAuth(req, res, next) {
  const secret = process.env.ADMIN_SECRET || '';

  if (!secret) {
    return res.status(503).json({
      success: false,
      error: 'ADMIN_SECRET não configurado no servidor.',
    });
  }

  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: 'Não autorizado.' });
  }

  next();
}

module.exports = adminAuth;
