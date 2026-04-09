import { verifyApiKey, handleCors, json } from '../../lib/auth.js';
import { sendText } from '../../lib/whatsapp.js';

const fmt = n => Number(n).toLocaleString('en-IN');

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (req.method === 'POST') { const a = verifyApiKey(req); if (!a.ok) return json(res, 401, { error: a.error }); }
  if (process.env.NOTIFY_DAILY_DIGEST_EMAIL !== 'true') return json(res, 200, { skipped: true });

  const db = req.body?.db || {};
  const todayStr = new Date().toISOString().split('T')[0];
  const ms = todayStr.slice(0,7);

  const todayI = (db.income||[]).filter(r=>r.date===todayStr).reduce((s,r)=>s+(+r.amount),0);
  const todayE = (db.expenses||[]).filter(r=>r.date===todayStr).reduce((s,r)=>s+(+r.amount),0);
  const monthI = (db.income||[]).filter(r=>r.date.startsWith(ms)).reduce((s,r)=>s+(+r.amount),0);
  const monthE = (db.expenses||[]).filter(r=>r.date.startsWith(ms)).reduce((s,r)=>s+(+r.amount),0);
  const now = new Date();
  const upEMIs = (db.loans||[]).filter(l=>l.type==='taken'&&l.due).map(l=>({...l,daysLeft:Math.round((new Date(l.due)-now)/86400000)})).filter(l=>l.daysLeft>=0&&l.daysLeft<=3);

  let msg = `📊 *FinanceOS Daily — ${todayStr}*\n\n`;
  if (todayI>0||todayE>0){msg+=`*Today:*\n`;if(todayI>0)msg+=`💰 Income: ₹${fmt(todayI)}\n`;if(todayE>0)msg+=`💸 Spent: ₹${fmt(todayE)}\n`; msg+='\n';}
  msg += `*This Month:*\n💰 ₹${fmt(monthI)} in · 💸 ₹${fmt(monthE)} out\n📊 Net: ${monthI-monthE>=0?'+':''}₹${fmt(monthI-monthE)}\n`;
  if (upEMIs.length){msg+='\n⏰ *Upcoming EMIs:*\n';upEMIs.forEach(l=>{msg+=`• ${l.person}: ₹${fmt(l.emi||0)} — ${l.daysLeft===0?'TODAY':`in ${l.daysLeft}d`}\n`;});}
  msg += '\n_FinanceOS · Anwar_';

  try { await sendText(process.env.WA_RECIPIENT_NUMBER, msg); } catch(e) { console.warn('Daily WA:', e.message); }
  return json(res, 200, { success: true, date: todayStr, todayI, todayE, upEMIs: upEMIs.length });
}
