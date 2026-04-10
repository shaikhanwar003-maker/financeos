const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });
const TO  = () => process.env.RECIPIENT_EMAIL;
const FROM = () => process.env.EMAIL_FROM || 'FinanceOS <noreply@example.com>';

function base(title, bodyHtml) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{margin:0;padding:0;background:#0f0f11;font-family:'Segoe UI',Arial,sans-serif;color:#f0eee8;}
.w{max-width:600px;margin:0 auto;padding:28px 16px;}
.card{background:#16161a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;}
.hdr{background:#1e1e24;padding:22px 28px;border-bottom:1px solid rgba(255,255,255,0.08);}
.logo{font-size:20px;font-weight:700;color:#f0eee8;letter-spacing:-0.5px;}
.logo span{color:#2dce89;}
.bdy{padding:24px 28px;}
.ftr{padding:14px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#5a5a60;text-align:center;}
h2{margin:0 0 14px;font-size:17px;font-weight:600;color:#f0eee8;}
p{margin:0 0 10px;font-size:14px;line-height:1.6;color:#9a9898;}
.big-g{color:#2dce89;font-family:monospace;font-weight:700;font-size:26px;}
.big-r{color:#f5365c;font-family:monospace;font-weight:700;font-size:26px;}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;}
.row:last-child{border-bottom:none;}
.rl{color:#9a9898;}.rv{color:#f0eee8;font-family:monospace;}
.stats{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap;}
.stat{background:#1e1e24;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 16px;flex:1;min-width:110px;}
.sl{font-size:10px;color:#5a5a60;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;}
.sv{font-size:16px;font-weight:700;font-family:monospace;}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;}
.bg{background:rgba(45,206,137,0.15);color:#2dce89;}
.br{background:rgba(245,54,92,0.15);color:#f5365c;}
.ba{background:rgba(251,169,24,0.15);color:#fba918;}
.sep{height:1px;background:rgba(255,255,255,0.08);margin:16px 0;}
.btn{display:inline-block;background:#2dce89;color:#0f1f18;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;margin-top:8px;}
.alert{background:rgba(245,54,92,0.1);border:1px solid rgba(245,54,92,0.3);border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;}
.warn{background:rgba(251,169,24,0.1);border:1px solid rgba(251,169,24,0.3);border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;}
.info{background:rgba(45,206,137,0.08);border:1px solid rgba(45,206,137,0.2);border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;}
table.dt{width:100%;border-collapse:collapse;margin:14px 0;}
table.dt th{text-align:left;font-size:11px;color:#5a5a60;font-family:monospace;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);}
table.dt td{padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="w"><div class="card">
<div class="hdr"><div class="logo">Finance<span>OS</span></div></div>
<div class="bdy">${bodyHtml}</div>
<div class="ftr">FinanceOS · Secured by Supabase</div>
</div></div></body></html>`;
}

async function send({ subject, html, text }) {
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM(), to: TO(), subject, html, text }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`Resend: ${d?.message || JSON.stringify(d)}`);
    return { provider: 'resend', id: d.id };
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const nm = await import('nodemailer').then(m => m.default || m);
    const t = nm.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    const info = await t.sendMail({ from: FROM(), to: TO(), subject, html, text });
    return { provider: 'gmail', id: info.messageId };
  }
  throw new Error('No email provider configured.');
}

export async function sendTransactionEmail(txn) {
  const isInc = txn.kind === 'income';
  if (isInc && process.env.NOTIFY_EMAIL_ON_INCOME !== 'true') return null;
  if (!isInc && process.env.NOTIFY_EMAIL_ON_EXPENSE !== 'true') return null;
  if (!isInc && +txn.amount < +(process.env.NOTIFY_EMAIL_ON_EXPENSE_THRESHOLD || 0)) return null;
  const icon = isInc ? '💰' : txn.kind === 'loan' ? '🏦' : '💸';
  const subject = `${icon} ${isInc ? 'Income' : 'Expense'} — ₹${fmt(txn.amount)} (${txn.category || txn.source})`;
  const html = base(subject, `<h2>${icon} ${isInc ? 'Income Received' : 'Expense Recorded'}</h2>
    <div class="${isInc ? 'big-g' : 'big-r'}" style="margin-bottom:8px">${isInc ? '+' : '-'}₹${fmt(txn.amount)}</div>
    <p>${txn.description}</p><div class="sep"></div>
    <div class="row"><span class="rl">Date</span><span class="rv">${txn.date}</span></div>
    <div class="row"><span class="rl">${isInc ? 'Source' : 'Category'}</span><span class="rv"><span class="badge ${isInc ? 'bg' : 'br'}">${txn.category || txn.source || '—'}</span></span></div>
    ${txn.mode ? `<div class="row"><span class="rl">Mode</span><span class="rv">${txn.mode}</span></div>` : ''}
    ${txn.extra ? `<div class="info" style="margin-top:14px">${txn.extra}</div>` : ''}
    <a href="#" class="btn">Open FinanceOS →</a>`);
  return send({ subject, html, text: subject });
}

export async function sendEMIReminderEmail({ emi, person, loanCat, dueDate, daysLeft, remaining }) {
  const urgent = daysLeft <= 1;
  const subject = `⏰ EMI Due ${urgent ? 'TODAY' : `in ${daysLeft} days`} — ${person}`;
  const html = base(subject, `<h2>⏰ EMI Reminder</h2>
    <div class="${urgent ? 'alert' : 'warn'}"><strong>${urgent ? '🚨 Due TODAY!' : `⚠️ Due in ${daysLeft} days`}</strong></div>
    <div class="stats">
      <div class="stat"><div class="sl">EMI Amount</div><div class="sv" style="color:#f5365c">₹${fmt(emi)}</div></div>
      <div class="stat"><div class="sl">Due Date</div><div class="sv" style="color:#fba918">${dueDate}</div></div>
      <div class="stat"><div class="sl">Outstanding</div><div class="sv">₹${fmt(remaining)}</div></div>
    </div>
    <div class="row"><span class="rl">Lender</span><span class="rv">${person}</span></div>
    <a href="#" class="btn">Record Payment →</a>`);
  return send({ subject, html, text: `EMI Reminder: ₹${fmt(emi)} due for ${person} on ${dueDate}.` });
}

export async function sendMonthlyReportEmail({ monthLabel, income, expenses, net, savingsRate, topExpenseCategories = [], loanOutstanding = 0 }) {
  const subject = `📊 FinanceOS Monthly Report — ${monthLabel}`;
  const catRows = topExpenseCategories.slice(0,5).map(c =>
    `<tr><td>${c.category}</td><td style="text-align:right;color:#f5365c;font-family:monospace">₹${fmt(c.amount)}</td><td style="text-align:right;color:#9a9898">${c.pct}%</td></tr>`).join('');
  const html = base(subject, `<h2>📊 Monthly Report — ${monthLabel}</h2>
    <div class="stats">
      <div class="stat"><div class="sl">Income</div><div class="sv" style="color:#2dce89">₹${fmt(income)}</div></div>
      <div class="stat"><div class="sl">Expenses</div><div class="sv" style="color:#f5365c">₹${fmt(expenses)}</div></div>
      <div class="stat"><div class="sl">Net</div><div class="sv" style="color:${net>=0?'#2dce89':'#f5365c'}">${net>=0?'+':''}₹${fmt(net)}</div></div>
    </div>
    ${savingsRate!==undefined?`<div class="info">Savings rate: <strong style="color:#2dce89">${savingsRate}%</strong></div>`:''}
    ${catRows?`<table class="dt"><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead><tbody>${catRows}</tbody></table>`:''}
    <a href="#" class="btn">View Full Report →</a>`);
  return send({ subject, html, text: `Monthly ${monthLabel}: Income ₹${fmt(income)}, Expenses ₹${fmt(expenses)}, Net ${net>=0?'+':''}₹${fmt(net)}` });
}

export async function sendWeeklyDigestEmail({ weekLabel, income, expenses, net, topCategory, txnCount = 0 }) {
  const subject = `📅 FinanceOS Weekly — ${weekLabel}`;
  const html = base(subject, `<h2>📅 Weekly Digest — ${weekLabel}</h2>
    <div class="stats">
      <div class="stat"><div class="sl">Income</div><div class="sv" style="color:#2dce89">₹${fmt(income)}</div></div>
      <div class="stat"><div class="sl">Expenses</div><div class="sv" style="color:#f5365c">₹${fmt(expenses)}</div></div>
      <div class="stat"><div class="sl">Net</div><div class="sv" style="color:${net>=0?'#2dce89':'#f5365c'}">${net>=0?'+':''}₹${fmt(net)}</div></div>
    </div>
    <div class="row"><span class="rl">Transactions</span><span class="rv">${txnCount}</span></div>
    ${topCategory?`<div class="row"><span class="rl">Top Expense</span><span class="rv"><span class="badge ba">${topCategory}</span></span></div>`:''}
    <a href="#" class="btn">View Dashboard →</a>`);
  return send({ subject, html, text: `Weekly ${weekLabel}: Income ₹${fmt(income)}, Expenses ₹${fmt(expenses)}, Net ${net>=0?'+':''}₹${fmt(net)}` });
}

export async function sendBudgetAlertEmail({ category, spent, budget, pct }) {
  const subject = `🚨 Budget Alert — ${category} at ${pct}%`;
  const html = base(subject, `<h2>🚨 Budget Alert</h2>
    <div class="alert"><strong>${category}</strong> is at ${pct}% of budget</div>
    <div class="stats">
      <div class="stat"><div class="sl">Spent</div><div class="sv" style="color:#f5365c">₹${fmt(spent)}</div></div>
      <div class="stat"><div class="sl">Budget</div><div class="sv">₹${fmt(budget)}</div></div>
      <div class="stat"><div class="sl">Remaining</div><div class="sv" style="color:#fba918">₹${fmt(budget-spent)}</div></div>
    </div>
    <a href="#" class="btn">View Budget →</a>`);
  return send({ subject, html, text: subject });
}
