import { verifyApiKey, handleCors, json } from '../../lib/auth.js';
import { sendWeeklyDigestWA } from '../../lib/whatsapp.js';
import { sendWeeklyDigestEmail } from '../../lib/email.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (req.method === 'POST') { const a = verifyApiKey(req); if (!a.ok) return json(res, 401, { error: a.error }); }

  const db = req.body?.db || {};
  const now = new Date();
  const ws = new Date(now); ws.setDate(now.getDate()-7);
  const wsStr = ws.toISOString().split('T')[0];
  const weekLabel = `${ws.toLocaleString('en-IN',{day:'numeric',month:'short'})} – ${now.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`;

  const fw = arr => (arr||[]).filter(r=>r.date>=wsStr);
  const income   = fw(db.income).reduce((s,r)=>s+(+r.amount),0);
  const expenses = fw(db.expenses).reduce((s,r)=>s+(+r.amount),0);
  const net = income - expenses;
  const txnCount = fw(db.income).length + fw(db.expenses).length;

  const cats={};
  fw(db.expenses).forEach(r=>{cats[r.category]=(cats[r.category]||0)+(+r.amount);});
  const topCategory = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;

  const [wa, email] = await Promise.allSettled([
    sendWeeklyDigestWA({ weekLabel, income, expenses, net, topCategory }),
    sendWeeklyDigestEmail({ weekLabel, income, expenses, net, topCategory, txnCount }),
  ]);

  return json(res, 200, {
    success: true, weekLabel,
    summary: { income, expenses, net, txnCount },
    sent: { whatsapp: wa.status==='fulfilled', email: email.status==='fulfilled' },
  });
}
