import { verifyApiKey, handleCors, json } from '../../lib/auth.js';
import { notifyIncome, notifyExpense, notifyLoanPayment, notifyPocketMoney, notifyFuel } from '../../lib/whatsapp.js';
import { sendTransactionEmail, sendBudgetAlertEmail } from '../../lib/email.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

  const auth = verifyApiKey(req);
  if (!auth.ok) return json(res, 401, { error: auth.error });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { type, data } = body || {};
  if (!type || !data) return json(res, 400, { error: 'Missing type or data' });

  const results = { wa: null, email: null, errors: [] };
  const settle = async (fn) => {
    try { return await fn(); } catch (e) { results.errors.push(e.message); return null; }
  };

  switch (type) {
    case 'income':
      results.wa    = await settle(() => notifyIncome(data));
      results.email = await settle(() => sendTransactionEmail({ ...data, kind: 'income' }));
      break;
    case 'expense':
      results.wa    = await settle(() => notifyExpense(data));
      results.email = await settle(() => sendTransactionEmail({ ...data, kind: 'expense' }));
      break;
    case 'loan_payment':
      results.wa    = await settle(() => notifyLoanPayment(data));
      results.email = await settle(() => sendTransactionEmail({ ...data, kind: 'loan', extra: `Remaining: ₹${Number(data.remaining).toLocaleString('en-IN')}` }));
      break;
    case 'pocket_money':
      results.wa = await settle(() => notifyPocketMoney(data));
      break;
    case 'fuel':
      results.wa = await settle(() => notifyFuel(data));
      break;
    case 'budget_alert':
      results.email = await settle(() => sendBudgetAlertEmail(data));
      break;
    default:
      return json(res, 400, { error: `Unknown type: ${type}` });
  }

  return json(res, 200, {
    success: true, type,
    sent: { whatsapp: !!results.wa, email: !!results.email },
    errors: results.errors.length ? results.errors : undefined,
  });
}
