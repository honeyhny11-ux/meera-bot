import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveVoiceSkill } from './db.js';

// The Voice Skill: Supabase copy wins (so it can be updated without a redeploy),
// otherwise voice-skill.txt from the repo.
export async function loadVoiceSkill() {
  try {
    const fromDb = await getActiveVoiceSkill();
    if (fromDb) return fromDb;
  } catch (e) {
    console.error('Voice skill DB read failed, using file:', e.message);
  }
  return readFileSync(join(process.cwd(), 'voice-skill.txt'), 'utf8').trim();
}
