import { verifyApiKey, handleCors, json } from '../../lib/auth.js';
import { sendEMIReminder } from '../../lib/whatsapp.js';
import { sendEMIReminderEmail } from '../../lib/email.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (req.method === 'POST') { const a = verifyApiKey(req); if (!a.ok) return json(res, 401, { error: a.error }); }

  const loans = req.body?.loans || [];
  const days = +(process.env.NOTIFY_EMI_REMINDER_DAYS_BEFORE || 3);
  const now = new Date();
  const reminded = [];

  for (const l of loans) {
    if (l.type !== 'taken') continue;
    const remaining = +l.amount - (l.paidBefore || 0) - (l.paid || 0);
    if (remaining <= 0 || !l.due) continue;
    const daysLeft = Math.round((new Date(l.due) - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= days) {
      try {
        await Promise.allSettled([
          sendEMIReminder({ emi: l.emi || remaining, person: l.person, dueDate: l.due, daysLeft }),
          sendEMIReminderEmail({ emi: l.emi || remaining, person: l.person, loanCat: l.loanCat || 'Loan', dueDate: l.due, daysLeft, remaining }),
        ]);
        reminded.push({ person: l.person, daysLeft, emi: l.emi });
      } catch (e) { console.error('EMI reminder error:', e.message); }
    }
  }

  return json(res, 200, { success: true, checked: loans.filter(l => l.type === 'taken').length, reminded: reminded.length, details: reminded });
}
