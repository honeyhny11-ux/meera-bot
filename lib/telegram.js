// Minimal Telegram Bot API helpers.

async function call(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

// Plain text (no parse_mode) so drafts never break on Markdown characters.
export function sendMessage(chatId, text, replyTo) {
  return call('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...(replyTo && { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } }),
  });
}

export function sendTyping(chatId) {
  return call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
}
