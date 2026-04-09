import { verifyApiKey, handleCors, json } from '../../lib/auth.js';
import { sendMonthlySummaryWA } from '../../lib/whatsapp.js';
import { sendMonthlyReportEmail } from '../../lib/email.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (req.method === 'POST') { const a = verifyApiKey(req); if (!a.ok) return json(res, 401, { error: a.error }); }

  const db = req.body?.db || {};
  const now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmStr = `${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}`;
  const monthLabel = lm.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const f = (arr) => (arr || []).filter(r => (r.date || '').startsWith(lmStr));
  const income   = f(db.income).reduce((s,r)=>s+(+r.amount),0);
  const expenses = f(db.expenses).reduce((s,r)=>s+(+r.amount),0);
  const net = income - expenses;
  const savingsRate = income > 0 ? Math.round((net/income)*100) : 0;

  const cats = {};
  f(db.expenses).forEach(r => { cats[r.category] = (cats[r.category]||0)+(+r.amount); });
  const topExpenseCategories = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([category, amount]) => ({ category, amount, pct: expenses>0?Math.round((amount/expenses)*100):0 }));

  const loanOutstanding = (db.loans||[]).filter(l=>l.type==='taken')
    .reduce((s,l)=>s+Math.max(0,+l.amount-(l.paidBefore||0)-(l.paid||0)),0);

  const [wa, email] = await Promise.allSettled([
    sendMonthlySummaryWA({ monthLabel, income, expenses, net }),
    sendMonthlyReportEmail({ monthLabel, income, expenses, net, savingsRate, topExpenseCategories, loanOutstanding }),
  ]);

  return json(res, 200, {
    success: true, month: lmStr, monthLabel,
    summary: { income, expenses, net, savingsRate },
    sent: { whatsapp: wa.status==='fulfilled', email: email.status==='fulfilled' },
  });
}
