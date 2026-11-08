import { codes } from './countries.js';
import { readCards, validateCards } from './vip-config.js';
const encoder = new TextEncoder();
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
const ADMIN_PAGE_PATH = '/admin';
const ADMIN_API_PREFIX = '/admin/api';
async function signingKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode(JSON.stringify([env.ADMIN_USERNAME, env.ADMIN_PASSWORD])), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
async function session(env) {
  const expires = String(Math.floor(Date.now() / 1000) + 28800);
  return expires + '.' + hex(await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(expires)));
}
async function authenticated(req, env) {
  const value = (req.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('guojia_session='))?.slice(15);
  if (!value || !/^\d{10}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, sig] = value.split('.');
  if (Number(expires) <= Date.now() / 1000 || Number(expires) > Date.now() / 1000 + 28860) return false;
  return crypto.subtle.verify('HMAC', await signingKey(env), new Uint8Array(sig.match(/../g).map(x => parseInt(x, 16))), encoder.encode(expires));
}
async function equal(a, b) {
  const hash = s => crypto.subtle.digest('SHA-256', encoder.encode(String(s)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  return new Uint8Array(x).reduce((diff, byte, i) => diff | (byte ^ new Uint8Array(y)[i]), 0) === 0;
}
async function body(req) {
  if (Number(req.headers.get('Content-Length') || 0) > 16384) throw new Error('提交内容过大');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('提交内容为空');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) { await reader.cancel(); throw new Error('提交内容过大'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('无效的 JSON 内容'); }
}
function validate(data) {
  if (!data || typeof data !== 'object') throw new Error('节点格式错误');
  if (!codes.includes(data.country)) throw new Error('请选择有效的国家或地区');
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 60) throw new Error('节点名称应为 1–60 个字符');
  if (!['available', 'outage'].includes(data.status)) throw new Error('状态无效');
  if (!Array.isArray(data.tiers) || !data.tiers.length || data.tiers.length > 3 || data.tiers.some(x => ![1, 2, 3].includes(x))) throw new Error('至少选择一个有效套餐');
  if (typeof data.note !== 'string' || data.note.length > 200) throw new Error('备注最多 200 个字符');
  if (!Number.isInteger(data.sort_order) || Math.abs(data.sort_order) > 99999) throw new Error('排序需为 -99999 到 99999 的整数');
  const quantity = data.quantity === undefined ? 1 : data.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) throw new Error('节点数量需为 1–200 的整数');
  return { ...data, quantity, name: data.name.trim(), tiers: [...new Set(data.tiers)].sort(), note: data.note.trim() };
}
async function list(env) {
  const results = await env.DB.batch([
    env.DB.prepare("SELECT nodes.*, COALESCE(CAST(q.value AS INTEGER), 1) AS quantity FROM nodes LEFT JOIN metadata q ON q.key = 'node_quantity:' || nodes.id ORDER BY sort_order ASC, country ASC, name ASC, id ASC"),
    env.DB.prepare("SELECT value FROM metadata WHERE key = 'updated_at'"),
    env.DB.prepare("SELECT value FROM metadata WHERE key = 'vip_card_settings'")
  ]);
  return { cards: readCards(results[2].results[0]?.value), nodes: results[0].results.map(n => ({ ...n, tiers: JSON.parse(n.tiers), quantity: Number.isInteger(n.quantity) && n.quantity >= 1 && n.quantity <= 200 ? n.quantity : 1 })), updated_at: results[1].results[0]?.value || null };
}
function cookie(req, value, maxAge) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `guojia_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
async function handle(req, env) {
  const url = new URL(req.url), path = url.pathname;
  const configured = env.ADMIN_USERNAME && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 16;
  const prefix = ADMIN_API_PREFIX;
  if (path === '/api/status' || path.startsWith(prefix + '/')) {
    if (!env.DB) return json({ error: '数据库尚未绑定，请完成 D1 配置' }, 503);
    if (path === '/api/status') return req.method === 'GET' ? json(await list(env)) : json({ error: '请求方法不支持' }, 405);
    if (!configured) return json({ error: '请设置管理员账号及至少 16 位密码' }, 503);
    const action = path.slice(prefix.length);
    if (req.method !== 'GET' && req.headers.get('Origin') !== url.origin) return json({ error: '请求来源无效，请从本站后台操作' }, 403);
    if (action === '/login' && req.method === 'POST') {
      let data; try { data = await body(req); } catch (e) { return json({ error: e.message }, 400); }
      const ip = req.headers.get('CF-Connecting-IP') || 'local';
      const key = hex(await crypto.subtle.digest('SHA-256', encoder.encode(ip)));
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').bind(now).run();
      const attempt = await env.DB.prepare('INSERT INTO login_attempts (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts, expires_at').bind(key, now + 900).first();
      if (attempt.attempts > 10) return json({ error: '尝试次数过多，请 15 分钟后再试' }, 429, { 'Retry-After': String(Math.max(1, attempt.expires_at - now)) });
      const [userOK, passwordOK] = await Promise.all([equal(data?.username, env.ADMIN_USERNAME), equal(data?.password, env.ADMIN_PASSWORD)]);
      if (!userOK || !passwordOK) return json({ error: '账号或密码错误' }, 401);
      await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, await session(env), 28800) });
    }
    if (!await authenticated(req, env)) return json({ error: '请先登录，或登录已过期' }, 401);
    if (action === '/session' && req.method === 'GET') return json({ ok: true });
    if (action === '/logout' && req.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, '', 0) });
    if (action === '/settings' && req.method === 'GET') {
      const row = await env.DB.prepare("SELECT value FROM metadata WHERE key = 'vip_card_settings'").first();
      return json({ cards: readCards(row?.value) });
    }
    if (action === '/settings' && req.method === 'PUT') {
      let cards; try { cards = validateCards((await body(req))?.cards); } catch (error) { return json({ error: error.message }, 400); }
      await env.DB.batch([
        env.DB.prepare("INSERT INTO metadata (key, value) VALUES ('vip_card_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(cards)),
        env.DB.prepare("UPDATE metadata SET value = ? WHERE key = 'updated_at'").bind(new Date().toISOString())
      ]);
      return json({ ok: true, cards });
    }
    if (action === '/nodes' && req.method === 'GET') return json(await list(env));
    if (action === '/nodes' && req.method === 'POST') {
      let node; try { node = validate(await body(req)); } catch (e) { return json({ error: e.message }, 400); }
      const timestamp = new Date().toISOString();
      const id = node.id || crypto.randomUUID();
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return json({ error: '节点 ID 无效' }, 400);
      if (node.id && !await env.DB.prepare('SELECT id FROM nodes WHERE id = ?').bind(id).first()) return json({ error: '节点已不存在，请刷新页面' }, 404);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO nodes (id, country, name, status, tiers, note, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET country=excluded.country, name=excluded.name, status=excluded.status, tiers=excluded.tiers, note=excluded.note, sort_order=excluded.sort_order, updated_at=excluded.updated_at').bind(id, node.country, node.name, node.status, JSON.stringify(node.tiers), node.note, node.sort_order, timestamp),
        env.DB.prepare("INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind('node_quantity:' + id, String(node.quantity)),
        env.DB.prepare("UPDATE metadata SET value = ? WHERE key = 'updated_at'").bind(timestamp)
      ]);
      return json({ ok: true, id });
    }
    if (action.startsWith('/nodes/') && req.method === 'DELETE') {
      const id = action.slice(7);
      if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: '节点 ID 无效' }, 400);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM nodes WHERE id = ?').bind(id),
        env.DB.prepare('DELETE FROM metadata WHERE key = ?').bind('node_quantity:' + id),
        env.DB.prepare("UPDATE metadata SET value = ? WHERE key = 'updated_at'").bind(new Date().toISOString())
      ]);
      return json({ ok: true });
    }
    return json({ error: '接口不存在' }, 404);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers });
  let asset;
  if (path === '/' || path === '/index.html') asset = '/index.html';
  else if (path === ADMIN_PAGE_PATH || path === ADMIN_PAGE_PATH + '/') {
    if (!configured) return new Response('后台配置未完成：请检查 ADMIN_USERNAME、ADMIN_PASSWORD（至少 16 位）。', { status: 503, headers });
    asset = '/admin.html';
  } else if (['/styles.css', '/app.js', '/countries.js', '/status-model.js', '/vip-config.js', '/favicon.svg'].includes(path)) asset = path;
  else return new Response('页面不存在', { status: 404, headers });
  const response = await env.ASSETS.fetch(new Request(new URL(asset, req.url), { method: req.method }));
  const result = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
  return result;
}
export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (error) { console.error('Request failed:', error.message); return json({ error: '服务暂时不可用，请检查数据库绑定及初始化是否完成' }, 503); }
  }
};
