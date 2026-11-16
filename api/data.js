// Shared history: faculty data (messages, announcements, uploads) and per-user chat logs.
const db = require('./_db');

const uni = (a, b, keyf, combine) => {
  const m = new Map();
  [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach(x => {
    if (!x || typeof x !== 'object') return;
    const k = keyf(x); m.set(k, m.has(k) && combine ? combine(m.get(k), x) : x);
  });
  return [...m.values()];
};
const msgKey = m => m.id || ((m.ts || m.date || '') + '|' + (m.from || m.to || '') + '|' + (m.subject || ''));
function mergeFaculty(old, inc) {
  old = old || {}; inc = inc || {};
  const deleted = [...new Set([...(old.annDeleted || []), ...(inc.annDeleted || [])].map(String))];
  return {
    uploads: uni(old.uploads, inc.uploads, u => u.id || u.title, (o, n) => ({ ...o, ...n, views: Math.max(o.views || 0, n.views || 0) })),
    messages: uni(old.messages, inc.messages, msgKey),
    outbox: uni(old.outbox, inc.outbox, msgKey),
    userAnn: uni(old.userAnn, inc.userAnn, a => a.aid).filter(a => !deleted.includes(String(a.aid))),
    annDeleted: deleted,
    customQB: uni(old.customQB, inc.customQB, q => (q.type || '') + '|' + (q.q || ''))
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!db.enabled()) return res.status(503).json({ error: 'no_db' });
  try {
    if (req.method === 'GET') {
      const scope = String(req.query.scope || '');
      if (scope === 'faculty') return res.status(200).json({ docs: await db.getScope('faculty') });
      if (scope === 'chat') {
        const key = String(req.query.key || '').slice(0, 200);
        const d = await db.getDoc('chat', key);
        return res.status(200).json({ log: (d && d.log) || [] });
      }
      return res.status(400).json({ error: 'bad scope' });
    }
    if (req.method === 'POST') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
      if (!b) return res.status(400).json({ error: 'bad body' });
      if (b.scope === 'faculty') {
        const id = String(b.key || '').slice(0, 80); if (!id) return res.status(400).json({ error: 'no key' });
        const merged = mergeFaculty(await db.getDoc('faculty', id), b.doc);
        await db.putDoc('faculty', id, merged);
        return res.status(200).json({ doc: merged });
      }
      if (b.scope === 'chat') {
        const key = String(b.key || '').slice(0, 200); if (!key) return res.status(400).json({ error: 'no key' });
        const log = (Array.isArray(b.log) ? b.log : []).slice(-100).map(m => ({ who: String(m.who || '').slice(0, 8), text: String(m.text || '').slice(0, 8000) }));
        await db.putDoc('chat', key, { log });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'bad scope' });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'db_error' });
  }
};
module.exports.mergeFaculty = mergeFaculty;
