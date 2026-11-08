import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
export async function fixture(database = ':memory:') {
  const sqlite = new DatabaseSync(database);
  sqlite.exec(await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  const prepare = (sql, args = []) => ({
    bind(...values) { return prepare(sql, values); },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async run() { return sqlite.prepare(sql).run(...args); },
    execute() { return { results: sqlite.prepare(sql).all(...args) }; }
  });
  const env = {
    ADMIN_USERNAME: 'owner', ADMIN_PASSWORD: 'local-test-password-only-1234',
    DB: { prepare, async batch(statements) { sqlite.exec('BEGIN'); try { const values = statements.map(s => s.execute()); sqlite.exec('COMMIT'); return values; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } },
    ASSETS: { async fetch(req) { const name = new URL(req.url).pathname; try { const data = await readFile(new URL('../public' + name, import.meta.url)); const type = name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript'; return new Response(data, { headers: { 'Content-Type': type } }); } catch { return new Response('Not found', { status: 404 }); } } }
  };
  return { env, sqlite };
}
