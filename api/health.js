import { handleCors, json } from '../lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const checks = {
    server: true,
    whatsapp: !!(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN),
    email_resend: !!process.env.RESEND_API_KEY,
    email_gmail: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    supabase: !!process.env.SUPABASE_URL,
    api_key_set: !!process.env.FINANCEOS_API_KEY,
  };
  const ok = checks.server && checks.api_key_set && checks.whatsapp && (checks.email_resend || checks.email_gmail);
  return json(res, ok ? 200 : 503, {
    status: ok ? '✅ All systems go' : '⚠️ Some services not configured',
    checks,
    missing: Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),
    project: 'financeos-shaikhanwar003',
    timestamp: new Date().toISOString(),
  });
}
