// Note -> score gate -> keywords -> news -> draft in Meera's voice.
// This file never publishes anything. The output is a draft for Meera to judge (Check 07).

import { gemini } from './gemini.js';
import { findNews } from './news.js';
import { loadVoiceSkill } from './voice.js';

const threshold = () => Number(process.env.SCORE_THRESHOLD || 6);

// ---- Step 1: Score -------------------------------------------------------

const SCORE_PROMPT = `You screen raw notes for Meera Pillai, founder of Skinstinct (minimal-ingredient D2C skincare, Mumbai; ex-pharma; audience: 28-40 year old urban women who respond to founders who know their science).

Decide if this note has enough in it to become a strong LinkedIn post. Be strict: most raw notes should NOT pass.

0-3: logistics, task reminders, to-dos, abandoned half-sentences, no point being made.
4-5: an interesting topic but thin, vague, or no clear point of view yet.
6-7: a clear point or observation with some substance Meera could stand behind.
8-10: a specific, opinionated insight with evidence, a real story, or science her audience cares about.

Give a score and a one-line reason (max 20 words) addressed to Meera.

NOTE:
"""
{NOTE}
"""`;

export async function scoreNote(note) {
  const out = await gemini({
    prompt: SCORE_PROMPT.replace('{NOTE}', note),
    temperature: 0,
    schema: {
      type: 'OBJECT',
      properties: { score: { type: 'INTEGER' }, reason: { type: 'STRING' } },
      required: ['score', 'reason'],
    },
  });
  return { score: Math.max(0, Math.min(10, Math.round(out.score))), reason: out.reason };
}

// ---- Step 2: Keywords ----------------------------------------------------

export async function extractSearchQuery(note) {
  const out = await gemini({
    prompt: `Pull 3-5 search terms from this note that would find a recent, relevant news article (skincare, ingredients, D2C, regulation, manufacturing, consumer trends). Return them as one short search phrase suitable for Google News.\n\nNOTE:\n"""\n${note}\n"""`,
    temperature: 0,
    schema: {
      type: 'OBJECT',
      properties: { keywords: { type: 'ARRAY', items: { type: 'STRING' } }, query: { type: 'STRING' } },
      required: ['keywords', 'query'],
    },
  });
  return out.query;
}

// ---- Step 3: Draft -------------------------------------------------------

function draftSystem(voice) {
  return `You are drafting a LinkedIn post for Meera Pillai, founder of Skinstinct. She is the author; you are producing a draft she will edit and decide whether to publish.

Write exactly in her voice, as described in this Voice Skill:
"""
${voice}
"""

Rules:
- Build the post only from what is in her note (and the news item, if you use it). Never invent numbers, studies, customers, quotes or anecdotes.
- If the note mentions a claim you can't support from the note itself, keep it as her observation, not as a fact.
- Plain text only: no markdown, no bold, no bullet symbols LinkedIn won't render.
- No generic LinkedIn filler ("In today's fast-paced world", "Let that sink in", "Here's the thing"), no engagement bait, no hashtag stuffing.`;
}

export async function draftPost(note, news, voice) {
  const newsBlock = news
    ? `Headline: ${news.headline}\nSource: ${news.source} (${news.date})\nSummary: ${news.summary || '(none)'}`
    : 'None found.';

  const out = await gemini({
    system: draftSystem(voice),
    temperature: 0.8,
    prompt: `MEERA'S NOTE:\n"""\n${note}\n"""\n\nNEWS ITEM:\n${newsBlock}\n\nIf this news item is genuinely relevant, use it to make the post timely. If it doesn't fit naturally, ignore it. If you use it, only refer to what the headline and summary actually say.\n\nReturn the finished post and whether you used the news item.`,
    schema: {
      type: 'OBJECT',
      properties: { post: { type: 'STRING' }, used_news: { type: 'BOOLEAN' } },
      required: ['post', 'used_news'],
    },
  });
  return { post: out.post.trim(), usedNews: Boolean(news && out.used_news) };
}

// ---- Verify flag (not optional) -----------------------------------------

export function verifyBlock(news) {
  const line = '─────────────────────────────────';
  return `${line}\nNEWS SOURCE: ${news.headline}\nFROM: ${news.source} · ${news.date}\nLINK: ${news.link}\n⚠ Check this before publishing — you are the author of this claim\n${line}`;
}

// ---- Whole run -----------------------------------------------------------

export async function runPipeline(note) {
  const { score, reason } = await scoreNote(note);
  if (score < threshold()) return { passed: false, score, reason };

  const [query, voice] = await Promise.all([extractSearchQuery(note), loadVoiceSkill()]);
  const news = await findNews(query);
  const { post, usedNews } = await draftPost(note, news, voice);

  return { passed: true, score, reason, query, news: usedNews ? news : null, post };
}

export function formatDraftMessage(result) {
  const parts = [`✍️ DRAFT · score ${result.score}/10`, '', result.post];
  if (result.news) parts.push('', verifyBlock(result.news));
  parts.push('', 'Reply to this message with APPROVE or REJECT (you can add a reason after REJECT).');
  return parts.join('\n');
}
