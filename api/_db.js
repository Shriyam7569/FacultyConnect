// Shared Postgres access (Neon). DATABASE_URL is added by Vercel when the Neon store is connected.
// With global.__FC_MEM = true an in-memory store is used (for tests only).
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
let sql = null, ready = null;
const mem = { docs: new Map(), files: new Map() };

function enabled() { return !!global.__FC_MEM || !!url; }

async function init() {
  if (global.__FC_MEM) return;
  if (!sql) { const { neon } = require('@neondatabase/serverless'); sql = neon(url); }
  if (!ready) ready = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS fc_docs (scope text NOT NULL, k text NOT NULL, v jsonb NOT NULL, updated timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (scope, k))`;
    await sql`CREATE TABLE IF NOT EXISTS fc_files (id text PRIMARY KEY, name text, mime text, size integer, b64 text NOT NULL, created timestamptz NOT NULL DEFAULT now())`;
  })();
  await ready;
}

async function getDoc(scope, k) {
  await init();
  if (global.__FC_MEM) return mem.docs.get(scope + '|' + k) || null;
  const r = await sql`SELECT v FROM fc_docs WHERE scope = ${scope} AND k = ${k}`;
  return r.length ? r[0].v : null;
}
async function getScope(scope) {
  await init();
  if (global.__FC_MEM) { const o = {}; mem.docs.forEach((v, key) => { if (key.startsWith(scope + '|')) o[key.slice(scope.length + 1)] = v; }); return o; }
  const r = await sql`SELECT k, v FROM fc_docs WHERE scope = ${scope}`;
  const o = {}; r.forEach(x => { o[x.k] = x.v; }); return o;
}
async function putDoc(scope, k, v) {
  await init();
  if (global.__FC_MEM) { mem.docs.set(scope + '|' + k, v); return; }
  await sql`INSERT INTO fc_docs (scope, k, v, updated) VALUES (${scope}, ${k}, ${JSON.stringify(v)}::jsonb, now())
            ON CONFLICT (scope, k) DO UPDATE SET v = EXCLUDED.v, updated = now()`;
}
async function putFile(id, name, mime, size, b64) {
  await init();
  if (global.__FC_MEM) { mem.files.set(id, { name, mime, size, b64 }); return; }
  await sql`INSERT INTO fc_files (id, name, mime, size, b64) VALUES (${id}, ${name}, ${mime}, ${size}, ${b64})`;
}
async function getFile(id) {
  await init();
  if (global.__FC_MEM) return mem.files.get(id) || null;
  const r = await sql`SELECT name, mime, size, b64 FROM fc_files WHERE id = ${id}`;
  return r.length ? r[0] : null;
}
module.exports = { enabled, getDoc, getScope, putDoc, putFile, getFile };
