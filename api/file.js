// Stores uploaded files (PDF, Word, images, text) in the database and serves them back.
const db = require('./_db');
const crypto = require('crypto');
const OK = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/(png|jpe?g|webp|gif)|text\/plain)$/;
const MAX = 3 * 1024 * 1024;

module.exports = async (req, res) => {
  if (!db.enabled()) return res.status(503).json({ error: 'no_db' });
  try {
    if (req.method === 'GET') {
      const f = await db.getFile(String(req.query.id || ''));
      if (!f) return res.status(404).json({ error: 'not found' });
      const buf = Buffer.from(f.b64, 'base64');
      res.setHeader('Content-Type', f.mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(f.name || 'file'));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.status(200).send(buf);
    }
    if (req.method === 'POST') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
      if (!b || typeof b.data !== 'string' || !OK.test(String(b.mime || ''))) return res.status(400).json({ error: 'File type not allowed.' });
      const size = Math.floor(b.data.length * 3 / 4);
      if (size > MAX) return res.status(413).json({ error: 'File is over 3 MB.' });
      const id = crypto.randomUUID();
      await db.putFile(id, String(b.name || 'file').slice(0, 200), b.mime, size, b.data);
      return res.status(200).json({ id });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'db_error' });
  }
};
