const BASE = `https://graph.facebook.com/${process.env.WA_API_VERSION || 'v19.0'}`;
const fmt = (n) => Number(n).toLocaleString('en-IN');
const TO  = () => process.env.WA_RECIPIENT_NUMBER;

async function sendWA(payload) {
  const res = await fetch(`${BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WA API ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

export async function sendTemplate(to, templateName, params = []) {
  return sendWA({
    messaging_product: 'whatsapp', to, type: 'template',
    template: { name: templateName, language: { code: 'en_IN' },
      components: params.length ? [{ type: 'body', parameters: params.map(t => ({ type: 'text', text: String(t) })) }] : [] },
  });
}

export async function sendText(to, text) {
  return sendWA({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } });
}

export async function notifyIncome(d) {
  if (process.env.NOTIFY_WA_ON_INCOME !== 'true') return null;
  return sendTemplate(TO(), process.env.WA_TEMPLATE_TXN || 'txn_alert', ['Income', `₹${fmt(d.amount)}`, d.source || 'Income', d.description]);
}

export async function notifyExpense(d) {
  if (process.env.NOTIFY_WA_ON_EXPENSE !== 'true') return null;
  if (+d.amount < +(process.env.NOTIFY_WA_ON_EXPENSE_THRESHOLD || 0)) return null;
  return sendTemplate(TO(), process.env.WA_TEMPLATE_TXN || 'txn_alert', ['Expense', `₹${fmt(d.amount)}`, d.category || 'Expense', d.description]);
}

export async function notifyLoanPayment(d) {
  if (process.env.NOTIFY_WA_ON_LOAN_PAYMENT !== 'true') return null;
  return sendTemplate(TO(), process.env.WA_TEMPLATE_TXN || 'txn_alert', ['Loan Payment', `₹${fmt(d.amount)}`, d.loanCat || 'Loan', `${d.loanPerson} — ₹${fmt(d.remaining)} remaining`]);
}

export async function notifyPocketMoney(d) {
  if (process.env.NOTIFY_WA_ON_POCKET_MONEY !== 'true') return null;
  return sendTemplate(TO(), process.env.WA_TEMPLATE_TXN || 'txn_alert', ['Pocket Money', `₹${fmt(d.amount)}`, d.memberName, d.purpose || 'Given']);
}

export async function notifyFuel(d) {
  if (process.env.NOTIFY_WA_ON_FUEL !== 'true') return null;
  return sendTemplate(TO(), process.env.WA_TEMPLATE_TXN || 'txn_alert', ['Fuel', `₹${fmt(d.amount)}`, d.vehicleName, `${d.liters}L @ ₹${fmt(d.pricePerL)}/L`]);
}

export async function sendEMIReminder(d) {
  return sendTemplate(TO(), process.env.WA_TEMPLATE_EMI || 'emi_reminder', [`₹${fmt(d.emi)}`, d.person, d.dueDate, String(d.daysLeft)]);
}

export async function sendMonthlySummaryWA(d) {
  return sendTemplate(TO(), process.env.WA_TEMPLATE_MONTHLY || 'monthly_summary', [d.monthLabel, fmt(d.income), fmt(d.expenses), (d.net >= 0 ? '+' : '') + fmt(d.net)]);
}

export async function sendWeeklyDigestWA(d) {
  const body = `📅 *FinanceOS Weekly — ${d.weekLabel}*\n\n💰 Income: *₹${fmt(d.income)}*\n💸 Expenses: *₹${fmt(d.expenses)}*\n📊 Net: *${d.net >= 0 ? '+' : ''}₹${fmt(d.net)}*\n` +
    (d.topCategory ? `🏆 Top spend: *${d.topCategory}*\n` : '') + `\n_FinanceOS · shaikhanwar003_`;
  try { return await sendText(TO(), body); }
  catch { return sendMonthlySummaryWA({ monthLabel: d.weekLabel, income: d.income, expenses: d.expenses, net: d.net }); }
}
