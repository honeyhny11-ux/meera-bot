# Meera Bot: Telegram note → LinkedIn draft

Meera sends a note to a Telegram bot. The bot:

1. **Scores** the note from 0–10 with Gemini. Below 6, she gets a one-line reason and no draft.
2. **Extracts keywords** and pulls the top **Google News** result (free, no key).
3. **Drafts** a LinkedIn post in her voice (Gemini + `voice-skill.txt`), using the news only if it fits.
4. Sends the draft back in Telegram. If news was used, a **verify flag** with the source, date and link is attached.
5. **Saves** the note and draft to Supabase as `pending`. When Meera replies **APPROVE** or **REJECT**, the status updates. Nothing is deleted.

**The Cut (Check 07):** the bot never posts to LinkedIn. Meera edits and publishes it herself.

## Files

| File | What it does |
|---|---|
| `api/webhook.js` | The URL Telegram calls. Routes notes, APPROVE/REJECT replies and /start |
| `lib/pipeline.js` | Score → keywords → news → draft, plus the verify block. **All prompts live here** |
| `lib/voice.js` | Loads the Voice Skill (Supabase if set, else `voice-skill.txt`) |
| `lib/gemini.js` | Calls the Gemini API |
| `lib/news.js` | Google News RSS search |
| `lib/db.js` | Supabase reads/writes (skipped if not configured) |
| `lib/telegram.js` | Sends Telegram messages |
| `supabase/schema.sql` | Creates the `notes`, `drafts`, `voice_skill` tables |
| `scripts/try-note.js` | Test a note locally: `npm run try -- "note text"` |
| `scripts/sync-voice.js` | Copy `voice-skill.txt` into Supabase: `npm run sync-voice` |

## Setup

1. **Voice Skill:** paste your profile into `voice-skill.txt`.
2. **Keys:** fill in `.env` (never commit it; it's in `.gitignore`).
3. **Supabase:** open SQL Editor, paste `supabase/schema.sql` and run it. Copy the Project URL and the service_role/secret key from Project Settings → API Keys.
4. **Test locally:** `npm run try -- "a strong note"`.
5. **Deploy:** push to GitHub, import the repo in Vercel, add every `.env` variable under Environment Variables, and deploy.
6. **Connect Telegram:** open this URL in a browser:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
   It should return `"ok":true`. Leave off `&secret_token=...` if you didn't set a secret.
7. Send the bot `/start`. It replies with your chat id, which you can put in `ALLOWED_CHAT_ID` so only you can use it.
