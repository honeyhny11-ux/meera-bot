// Health check + one-click Telegram connection.
// GET /api/setup reports which pieces work (never shows key values) and points the
// Telegram webhook at this deployment's production URL.

import { dbEnabled } from '../lib/db.js';
import { gemini } from '../lib/gemini.js';

export default async function handler(req, res) {
  const report = {};
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const tg = (method, body) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then((r) => r.json());

  for (const k of ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ALLOWED_CHAT_ID']) {
    report[k] = process.env[k] ? 'set' : 'MISSING';
  }

  if (token) {
    const me = await tg('getMe');
    report.telegram_bot = me.ok ? `@${me.result.username}` : `FAILED: ${me.description}`;

    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (me.ok && host) {
      const url = `https://${host}/api/webhook`;
      const set = await tg('setWebhook', {
        url,
        allowed_updates: ['message', 'channel_post'],
        ...(process.env.TELEGRAM_WEBHOOK_SECRET && { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }),
      });
      report.webhook = set.ok ? `connected -> ${url}` : `FAILED: ${set.description}`;
      const info = await tg('getWebhookInfo');
      if (info.result?.last_error_message) report.webhook_last_error = info.result.last_error_message;
    }

    const chatId = process.env.ALLOWED_CHAT_ID;
    if (me.ok && chatId) {
      const member = await tg('getChatMember', { chat_id: chatId, user_id: me.result.id });
      report.bot_in_channel = member.ok ? member.result.status : `FAILED: ${member.description} (add the bot as a channel admin)`;
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      await gemini({ prompt: 'Reply with the word OK.', temperature: 0 });
      report.gemini = 'working';
    } catch (e) {
      report.gemini = `FAILED: ${e.message.slice(0, 200)}`;
    }
  }

  if (dbEnabled()) {
    const key = process.env.SUPABASE_SERVICE_KEY;
    const headers = { apikey: key, ...(key.startsWith('eyJ') && { Authorization: `Bearer ${key}` }) };
    for (const t of ['notes', 'drafts', 'voice_skill']) {
      const r = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${t}?limit=1`, { headers }).catch((e) => ({ ok: false, status: e.message }));
      report[`supabase_${t}`] = r.ok ? 'ok' : `FAILED (${r.status}) — run supabase/schema.sql`;
    }
  }

  res.status(200).json(report);
}
