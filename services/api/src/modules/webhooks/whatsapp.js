const { getRepository } = require('@aguia/whatsapp');

async function verifyMetaWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
    const repo = getRepository();
    const providers = await repo.list({ masked: false });
    const meta = providers.find(p => p.provider === 'meta_cloud' && p.enabled);

    if (mode === 'subscribe' && meta?.verify_token && token === meta.verify_token) {
      return res.status(200).send(challenge);
    }

    res.status(403).json({ success: false, error: 'Verificação do webhook falhou.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function receiveMetaWebhook(req, res) {
  res.status(200).json({ success: true });
}

module.exports = { verifyMetaWebhook, receiveMetaWebhook };
