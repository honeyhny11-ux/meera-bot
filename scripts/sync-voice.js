// Copy voice-skill.txt into the Supabase voice_skill table (becomes the active version).
// Usage: npm run sync-voice

import { readFileSync } from 'node:fs';
import { dbEnabled, saveVoiceSkill } from '../lib/db.js';

if (!dbEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env first.');
  process.exit(1);
}
await saveVoiceSkill(readFileSync('voice-skill.txt', 'utf8').trim());
console.log('Voice skill saved to Supabase and marked active.');
