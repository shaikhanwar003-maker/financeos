import { handleCors, json } from '../../lib/auth.js';
import { sendText } from '../../lib/whatsapp.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('[webhook] Verified ✓');
      return res.status(200).send(challenge);
    }
    return json(res, 403, { error: 'Verification failed. Check WEBHOOK_VERIFY_TOKEN.' });
  }

  if (req.method === 'POST') {
    res.status(200).json({ status: 'received' });
    processMessage(req.body).catch(e => console.error('[webhook]', e.message));
    return;
  }
  return json(res, 405, { error: 'Method not allowed' });
}

async function processMessage(body) {
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;
  const from = msg.from;
  const text = msg.text?.body?.trim().toLowerCase() || '';

  if (text === 'help') {
    await sendText(from, `🤖 *FinanceOS Bot*\n\n• *today* — today's summary\n• *month* — this month\n• *loans* — loan status\n• *stop* — pause alerts\n• *start* — resume alerts\n\n_FinanceOS · Anwar_`);
  } else if (text === 'stop') {
    await sendText(from, `✅ Alerts paused. Reply *start* to resume.\n_FinanceOS_`);
  } else if (text === 'start') {
    await sendText(from, `✅ Alerts resumed!\n_FinanceOS_`);
  }
}
