// Supabase memory layer via its REST API. If SUPABASE_* isn't set, every call is a no-op.

const url = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_KEY;

export const dbEnabled = () => Boolean(url() && key());

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: key(), 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys don't.
  if (key().startsWith('eyJ')) headers.Authorization = `Bearer ${key()}`;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${url()}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  if (res.status === 409) return { conflict: true };
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Returns the new note row, or null if this Telegram update was already processed (retry).
export async function saveNote({ updateId, chatId, text }) {
  if (!dbEnabled()) return { id: null };
  const rows = await sb('notes', {
    method: 'POST',
    prefer: 'return=representation',
    body: { telegram_update_id: updateId, chat_id: chatId, text },
  });
  return rows.conflict ? null : rows[0];
}

export async function updateNote(id, fields) {
  if (!dbEnabled() || !id) return;
  await sb(`notes?id=eq.${id}`, { method: 'PATCH', body: fields });
}

export async function saveDraft(fields) {
  if (!dbEnabled()) return;
  await sb('drafts', { method: 'POST', body: { ...fields, status: 'pending' } });
}

// Find the draft Meera is replying to; fall back to her latest pending one.
export async function findDraft(chatId, replyToMessageId) {
  if (replyToMessageId) {
    const rows = await sb(`drafts?chat_id=eq.${chatId}&telegram_message_id=eq.${replyToMessageId}&limit=1`);
    if (rows[0]) return rows[0];
  }
  const rows = await sb(`drafts?chat_id=eq.${chatId}&status=eq.pending&order=created_at.desc&limit=1`);
  return rows[0] ?? null;
}

export async function setDraftStatus(id, status, feedback) {
  await sb(`drafts?id=eq.${id}`, {
    method: 'PATCH',
    body: { status, feedback: feedback || null, decided_at: new Date().toISOString() },
  });
}

export async function getActiveVoiceSkill() {
  if (!dbEnabled()) return null;
  const rows = await sb('voice_skill?active=eq.true&order=created_at.desc&limit=1');
  return rows[0]?.content ?? null;
}

export async function saveVoiceSkill(content) {
  await sb('voice_skill?active=eq.true', { method: 'PATCH', body: { active: false } });
  await sb('voice_skill', { method: 'POST', body: { content, active: true } });
}
