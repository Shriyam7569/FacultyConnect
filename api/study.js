// Vercel serverless function: the study agent. The Gemini key lives only in the
// GEMINI_API_KEY environment variable (Vercel → Project Settings → Environment Variables).
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash';
const MAX_BODY_CHARS = 6_000_000;           // ~4.5 MB of base64 file data
const DAILY_LIMIT = 40;                      // questions per visitor per day (best-effort, per warm instance)
const hits = new Map();

const MODES = {
  ask:      'Answer the student\'s question using the study material. If the material does not cover it, say so, then give a short general explanation clearly marked as outside the material.',
  summary:  'Summarise the study material for revision: a one-paragraph overview, then the key points as short bullets, then 3 likely exam questions.',
  quiz:     'Write a 5-question quiz from the study material (mix of MCQ and short-answer). Number them, put answers and one-line explanations in a section after the questions.',
  cards:    'Create 8 flashcards from the study material as "Q: … / A: …" pairs, most important concepts first.',
  help:     'Chat naturally about anything the user wants — general knowledge, studying, careers, coding, advice, or everyday questions — like a friendly, capable assistant. Be helpful and concise (a short paragraph or a few bullets; plain text, no heavy markdown). When the question is about FacultyConnect, its faculty, office hours, courses, announcements or resources, use the SITE DATA supplied and do not invent details that are not there. Politely decline anything harmful or unsafe.',
  explain:  'Explain the topic in simple words with a small everyday example, then a 3-step recap. Assume the student is seeing it for the first time.'
};

function limited(ip){
  const day = new Date().toISOString().slice(0, 10), k = ip + day;
  const n = (hits.get(k) || 0) + 1; hits.set(k, n);
  if (hits.size > 5000) hits.clear();
  return n > DAILY_LIMIT;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });
  const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'You have reached today\'s study-agent limit. Try again tomorrow.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || JSON.stringify(b).length > MAX_BODY_CHARS) return res.status(400).json({ error: 'Request too large or invalid.' });

  const mode = MODES[b.mode] ? b.mode : 'ask';
  const history = Array.isArray(b.history) ? b.history.slice(-8) : [];
  const question = String(b.question || '').slice(0, 2000);
  const sourceText = String(b.text || '').slice(0, 60000);
  const files = (Array.isArray(b.files) ? b.files : []).slice(0, 3)
    .filter(f => f && typeof f.data === 'string' && /^(application\/pdf|image\/(png|jpe?g|webp|gif))$/.test(f.mime));

  const system = mode === 'help' ? ('You are the AI helpdesk assistant inside FacultyConnect, the Thapar Institute faculty directory. ' + MODES.help) : 'You are FacultyConnect\'s study agent for engineering students at Thapar Institute. ' +
    'Teach clearly and honestly. Base answers on the supplied study material, cite the section or page when you can, ' +
    'and never invent facts about the material. Keep answers focused; use short headings and bullets; use plain text math. ' + MODES[mode];

  const parts = [];
  files.forEach(f => parts.push({ inlineData: { mimeType: f.mime, data: f.data } }));
  if (sourceText) parts.push({ text: (mode === 'help' ? 'SITE DATA:\n' : 'STUDY MATERIAL (' + (b.title || 'pasted text') + '):\n') + sourceText });
  if (!files.length && !sourceText) parts.push({ text: '(No study material attached — answer from general knowledge and say so.)' });
  parts.push({ text: 'Student request: ' + (question || 'Go ahead.') });

  const contents = history.filter(h => h && (h.role === 'user' || h.role === 'model') && h.text)
    .map(h => ({ role: h.role, parts: [{ text: String(h.text).slice(0, 4000) }] }));
  contents.push({ role: 'user', parts });

  const payload = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.4, maxOutputTokens: mode === 'help' ? 900 : 1800 } });
  const ask = (m, ms) => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: payload, signal: AbortSignal.timeout(ms || 20000) });
  try {
    let r;
    try { r = await ask(MODEL, 8000); } catch (e) { r = null; }          // stalled or failed: use the lighter model
    if (!r || r.status === 503 || r.status === 429) r = await ask(FALLBACK, 25000);
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'The AI service returned an error.' });
    const text = (((j.candidates || [])[0] || {}).content || {}).parts;
    const answer = (text || []).map(p => p.text || '').join('').trim();
    return res.status(200).json({ answer: answer || 'I could not produce an answer for that — try rephrasing.' });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI service.' });
  }
};
