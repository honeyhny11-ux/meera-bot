// Telegram delivers every message sent to the bot here (see README: setWebhook).

import { sendMessage, sendTyping } from '../lib/telegram.js';
import { runPipeline, formatDraftMessage } from '../lib/pipeline.js';
import * as db from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Meera bot is running. Telegram posts to this URL.');

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).send('Bad secret');
  }

  try {
    await handleUpdate(req.body);
  } catch (e) {
    console.error('Unhandled error:', e);
  }
  // Always 200 so Telegram doesn't keep retrying the same update.
  res.status(200).json({ ok: true });
}

async function handleUpdate(update) {
  const msg = update?.message || update?.channel_post;
  if (!msg) return;
  const chatId = msg.chat.id;

  const allowed = process.env.ALLOWED_CHAT_ID;
  if (allowed && String(chatId) !== String(allowed)) return;

  const text = (msg.text || msg.caption || '').trim();
  if (!text) {
    return sendMessage(chatId, 'I can only read text right now. Send the note as a text message (or paste the voice-note transcript).', msg.message_id);
  }

  if (text.startsWith('/start') || text.startsWith('/help')) {
    return sendMessage(
      chatId,
      `Hi Meera. Send me any note, the way you already do.\n\nI'll score it; if it's worth developing I'll find a news angle and send back a draft in your voice. Nothing is ever posted for you. Reply APPROVE or REJECT to a draft to log your decision.\n\n(Your chat id: ${chatId})`
    );
  }

  const decision = text.match(/^(approve|approved|reject|rejected)\b[\s:,-]*(.*)$/is);
  if (decision) return handleDecision(msg, decision);

  return handleNote(msg, text, update.update_id);
}

async function handleNote(msg, text, updateId) {
  const chatId = msg.chat.id;

  const note = await db.saveNote({ updateId, chatId, text });
  if (!note) return; // Telegram retry of a note we're already handling.

  await sendTyping(chatId);
  try {
    const result = await runPipeline(text);

    if (!result.passed) {
      await db.updateNote(note.id, { score: result.score, score_reason: result.reason, status: 'rejected' });
      return sendMessage(chatId, `🗒 No draft · score ${result.score}/10\n${result.reason}\n\n(Kept in your notes in case you want to add to it.)`, msg.message_id);
    }

    const sent = await sendMessage(chatId, formatDraftMessage(result), msg.message_id);
    // The draft is already with Meera, so a save failure is a warning, not a pipeline error.
    try {
      await db.updateNote(note.id, { score: result.score, score_reason: result.reason, status: 'drafted' });
      await db.saveDraft({
        note_id: note.id,
        chat_id: chatId,
        telegram_message_id: sent.message_id,
        content: result.post,
        news: result.news,
        search_query: result.query,
        model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      });
    } catch (e) {
      console.error('Saving draft failed:', e);
      await sendMessage(chatId, `(Draft sent, but I couldn't save it to memory: ${e.message.slice(0, 200)})`);
    }
  } catch (e) {
    console.error('Pipeline failed:', e);
    await db.updateNote(note.id, { status: 'error', score_reason: String(e.message).slice(0, 500) }).catch(() => {});
    await sendMessage(chatId, `⚠️ Couldn't process that note: ${e.message.slice(0, 300)}`, msg.message_id);
  }
}

async function handleDecision(msg, match) {
  const chatId = msg.chat.id;
  if (!db.dbEnabled()) {
    return sendMessage(chatId, 'Memory isn\'t set up yet (Supabase keys missing), so I can\'t record that.', msg.message_id);
  }

  const status = match[1].toLowerCase().startsWith('approve') ? 'approved' : 'rejected';
  const draft = await db.findDraft(chatId, msg.reply_to_message?.message_id);
  if (!draft) return sendMessage(chatId, 'I couldn\'t find a draft to mark. Reply directly to the draft message.', msg.message_id);

  await db.setDraftStatus(draft.id, status, match[2]?.trim());
  const reply =
    status === 'approved'
      ? '✅ Marked APPROVED. Edit and post it on LinkedIn when you\'re ready. Publishing stays with you.'
      : '❌ Marked REJECTED. Kept on file so the drafts can improve.';
  return sendMessage(chatId, reply, msg.message_id);
}
