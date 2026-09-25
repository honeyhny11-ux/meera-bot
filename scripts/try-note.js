// Run a note through the pipeline on your computer, without Telegram or Supabase.
// Usage: npm run try -- "your note text here"

import { runPipeline, formatDraftMessage } from '../lib/pipeline.js';

process.env.SUPABASE_URL = ''; // local test: read voice-skill.txt, save nothing

const note = process.argv.slice(2).join(' ').trim();
if (!note) {
  console.error('Usage: npm run try -- "your note text here"');
  process.exit(1);
}

const result = await runPipeline(note);
if (!result.passed) {
  console.log(`NO DRAFT · score ${result.score}/10 — ${result.reason}`);
} else {
  console.log(`Search phrase: ${result.query}\n`);
  console.log(formatDraftMessage(result));
}
