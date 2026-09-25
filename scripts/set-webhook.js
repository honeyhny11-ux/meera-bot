// Tell Telegram to deliver the bot's messages to the deployed Vercel URL.
// Usage: npm run set-webhook -- https://your-app.vercel.app

const token = process.env.TELEGRAM_BOT_TOKEN;
const base = process.argv[2]?.replace(/\/$/, '');
if (!token || token.startsWith('your_')) throw new Error('Set TELEGRAM_BOT_TOKEN in .env first.');
if (!base?.startsWith('https://')) throw new Error('Usage: npm run set-webhook -- https://your-app.vercel.app');

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: `${base}/api/webhook`,
    allowed_updates: ['message', 'channel_post'],
    drop_pending_updates: true,
    ...(process.env.TELEGRAM_WEBHOOK_SECRET && { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }),
  }),
});
console.log(await res.json());

const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
console.log('Webhook now points to:', info.result?.url, info.result?.last_error_message ? `(last error: ${info.result.last_error_message})` : '');
