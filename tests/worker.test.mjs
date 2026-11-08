import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { DEFAULT_VIP_CARDS } from '../public/vip-config.js';
import { fixture } from './helpers.mjs';
import { flag, countryName } from '../public/countries.js';
const origin = 'https://status.example.com';
function call(env, path, method = 'GET', body, cookie, extraHeaders = {}) {
  return worker.fetch(new Request(origin + path, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
}
async function login(env) {
  const response = await call(env, '/admin/api/login', 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
  assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie'), /HttpOnly; SameSite=Strict.*Secure/);
  return response.headers.get('Set-Cookie').split(';')[0];
}
const sample = { country: 'JP', name: '日本 · 东京 01', status: 'available', tiers: [1, 3], note: '人工维护', sort_order: 0 };
test('公开页面、后台路径和源码访问隔离', async () => {
  const { env } = await fixture();
  for (const path of ['/', '/app.js', '/countries.js', '/styles.css', '/admin', '/admin/']) assert.equal((await call(env, path)).status, 200, path);
  for (const path of ['/admin.html', '/_worker.js', '/wrangler.toml', '/.dev.vars', '/wrong', '/private/control-extra']) assert.equal((await call(env, path)).status, 404, path);
  const response = await call(env, '/'); assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('首次部署没有虚构节点', async () => {
  const { env } = await fixture(); const response = await call(env, '/api/status');
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { cards: DEFAULT_VIP_CARDS, nodes: [], updated_at: null });
});
test('未登录、伪造会话不可增删改', async () => {
  const { env } = await fixture(); const base = '/admin/api';
  for (const [path, method, data] of [[base + '/nodes', 'POST', sample], [base + '/nodes/00000000-0000-0000-0000-000000000000', 'DELETE'], [base + '/nodes', 'GET']]) {
    assert.equal((await call(env, path, method, data, 'guojia_session=1999999999.' + '0'.repeat(64))).status, 401);
  }
});
test('登录、创建、更新、公开同步、删除完整流程', async () => {
  const { env } = await fixture(), cookie = await login(env), base = '/admin/api';
  assert.equal((await call(env, base + '/session', 'GET', undefined, cookie)).status, 200);
  const saved = await call(env, base + '/nodes', 'POST', sample, cookie); assert.equal(saved.status, 200); const { id } = await saved.json();
  const first = await (await call(env, '/api/status')).json(); assert.equal(first.nodes[0].name, sample.name); assert.deepEqual(first.nodes[0].tiers, [1, 3]); assert.ok(first.updated_at);
  assert.equal((await call(env, base + '/nodes', 'POST', { ...sample, id, status: 'outage', tiers: [3] }, cookie)).status, 200);
  const next = await (await call(env, '/api/status')).json(); assert.equal(next.nodes[0].status, 'outage'); assert.deepEqual(next.nodes[0].tiers, [3]);
  assert.equal((await call(env, base + '/nodes/' + id, 'DELETE', undefined, cookie)).status, 200);
  assert.equal((await (await call(env, '/api/status')).json()).nodes.length, 0);
  assert.equal((await call(env, base + '/nodes', 'POST', { ...sample, id }, cookie)).status, 404);
});
test('跨站提交、缺少 Origin 的提交被拒绝', async () => {
  const { env } = await fixture(), cookie = await login(env), base = '/admin/api';
  assert.equal((await call(env, base + '/nodes', 'POST', sample, cookie, { Origin: 'https://attacker.example' })).status, 403);
  const request = new Request(origin + base + '/nodes', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify(sample) });
  assert.equal((await worker.fetch(request, env)).status, 403);
});
test('字段、国家、套餐和请求体大小校验', async () => {
  const { env } = await fixture(), cookie = await login(env), path = '/admin/api/nodes';
  for (const data of [null, { ...sample, country: 'ZZ' }, { ...sample, tiers: [] }, { ...sample, tiers: [4] }, { ...sample, name: '' }, { ...sample, name: 'a'.repeat(61) }, { ...sample, note: 'x'.repeat(201) }, { ...sample, sort_order: 0.5 }, { ...sample, status: 'unknown' }, { ...sample, id: "'; DROP TABLE nodes; --" }, { ...sample, note: 'a'.repeat(17000) }]) assert.equal((await call(env, path, 'POST', data, cookie)).status, 400);
});
test('密码错误与登录限速', async () => {
  const { env } = await fixture(), path = '/admin/api/login';
  for (let i = 0; i < 10; i++) assert.equal((await call(env, path, 'POST', { username: 'owner', password: 'wrong' })).status, 401);
  const limited = await call(env, path, 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }); assert.equal(limited.status, 429); assert.ok(limited.headers.get('Retry-After'));
});
test('修改密码会使原会话失效，退出清除 cookie', async () => {
  const { env } = await fixture(), cookie = await login(env), base = '/admin/api';
  const logout = await call(env, base + '/logout', 'POST', {}, cookie); assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  env.ADMIN_PASSWORD = 'another-long-test-password-123';
  assert.equal((await call(env, base + '/session', 'GET', undefined, cookie)).status, 401);
});
test('后台配置和数据库缺失时明确报错', async () => {
  const { env } = await fixture();
  assert.equal((await call({ ...env, DB: undefined }, '/api/status')).status, 503);
  assert.equal((await call({ ...env, ADMIN_PASSWORD: 'short' }, '/admin')).status, 503);
});
test('自动国旗和中文国家名称', () => { assert.equal(flag('JP'), '🇯🇵'); assert.equal(flag('HK'), '🇭🇰'); assert.equal(flag('ZZ'), '🌐'); assert.equal(countryName('JP'), '日本'); });

test('固定后台路径：无路径变量也返回登录模板，未登录会话为 401', async () => {
  const { env } = await fixture();
  assert.equal(Object.hasOwn(env, 'ADMIN_PATH'), false);
  for (const path of ['/admin', '/admin/']) {
    const response = await call(env, path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    assert.match(await response.text(), /id="login-form"/);
  }
  assert.equal((await call(env, '/admin/api/session')).status, 401);
  for (const path of ['/private/control', '/private/control/', '/private/control/api/session', '/admin-extra']) assert.equal((await call(env, path)).status, 404, path);
});

test('旧路径变量不参与路由或签名，也不会被读取', async () => {
  const { env } = await fixture();
  env.ADMIN_PATH = '/legacy-console';
  const cookie = await login(env);
  Object.defineProperty(env, 'ADMIN_PATH', { get() { throw new Error('旧路径变量不得被读取'); } });
  assert.equal((await call(env, '/admin')).status, 200);
  assert.equal((await call(env, '/admin/')).status, 200);
  assert.equal((await call(env, '/admin/api/session', 'GET', undefined, cookie)).status, 200);
  assert.equal((await call(env, '/admin/api/nodes', 'POST', sample, cookie)).status, 200);
  assert.equal((await call(env, '/admin/api/logout', 'POST', {}, cookie)).status, 200);
  await login(env);
});

test('修改账号后原会话失效，旧账号无法登录，新账号可登录', async () => {
  const { env } = await fixture(), cookie = await login(env), oldUsername = env.ADMIN_USERNAME;
  env.ADMIN_USERNAME = 'new-test-owner';
  assert.equal((await call(env, '/admin/api/session', 'GET', undefined, cookie)).status, 401);
  assert.equal((await call(env, '/admin/api/login', 'POST', { username: oldUsername, password: env.ADMIN_PASSWORD })).status, 401);
  const newCookie = await login(env);
  assert.equal((await call(env, '/admin/api/session', 'GET', undefined, newCookie)).status, 200);
});

test('旧版三字段签名 cookie 不能用于新后台', async () => {
  const { env } = await fixture(), encoder = new TextEncoder();
  const expires = String(Math.floor(Date.now() / 1000) + 28800);
  const key = await crypto.subtle.importKey('raw', encoder.encode(JSON.stringify(['/admin', env.ADMIN_USERNAME, env.ADMIN_PASSWORD])), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(expires)))].map(b => b.toString(16).padStart(2, '0')).join('');
  assert.equal((await call(env, '/admin/api/session', 'GET', undefined, `guojia_session=${expires}.${signature}`)).status, 401);
});

test('已有节点和套餐归属在前台访问、登录和会话检查后保持不变', async () => {
  const { env, sqlite } = await fixture();
  const id = '11111111-1111-4111-8111-111111111111';
  await env.DB.prepare('INSERT INTO nodes (id, country, name, status, tiers, note, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, 'HK', '已有节点', 'outage', '[1,2,3]', '保留原备注', 7, '2026-11-01T00:00:00.000Z').run();
  const before = sqlite.prepare('SELECT * FROM nodes ORDER BY id').all();
  for (const path of ['/', '/?vip=1', '/?vip=2', '/?vip=3']) assert.equal((await call(env, path)).status, 200);
  const cookie = await login(env);
  assert.equal((await call(env, '/admin/api/session', 'GET', undefined, cookie)).status, 200);
  const data = await (await call(env, '/api/status')).json();
  assert.equal(data.nodes[0].id, id);
  assert.deepEqual(data.nodes[0].tiers, [1, 2, 3]);
  assert.equal(data.nodes[0].status, 'outage');
  assert.deepEqual(sqlite.prepare('SELECT * FROM nodes ORDER BY id').all(), before);
});

test('线路组数量10可保存、公开读取、编辑为5，并保留原节点字段', async () => {
  const { env } = await fixture(), cookie = await login(env);
  const response = await call(env, '/admin/api/nodes', 'POST', { ...sample, country: 'SG', quantity: 10 }, cookie);
  assert.equal(response.status, 200); const { id } = await response.json();
  let node = (await (await call(env, '/api/status')).json()).nodes[0];
  assert.equal(node.quantity, 10); assert.deepEqual(node.tiers, [1, 3]);
  assert.equal((await call(env, '/admin/api/nodes', 'POST', { ...node, quantity: 5, status: 'outage' }, cookie)).status, 200);
  node = (await (await call(env, '/admin/api/nodes', 'GET', undefined, cookie)).json()).nodes[0];
  assert.equal(node.quantity, 5); assert.equal(node.status, 'outage'); assert.equal(node.id, id);
});

test('旧记录未指定数量默认为1，不修改原数据库行', async () => {
  const { env, sqlite } = await fixture(), cookie = await login(env);
  await call(env, '/admin/api/nodes', 'POST', sample, cookie);
  sqlite.prepare("DELETE FROM metadata WHERE key LIKE 'node_quantity:%'").run();
  const before = sqlite.prepare('SELECT * FROM nodes').all();
  const data = await (await call(env, '/api/status')).json();
  assert.equal(data.nodes[0].quantity, 1);
  assert.deepEqual(sqlite.prepare('SELECT * FROM nodes').all(), before);
});

test('数量只接受1至200整数，拒绝非法数量且不写入节点', async () => {
  const { env } = await fixture(), cookie = await login(env);
  for (const quantity of [0, -1, 201, 1.5, '10', null, true]) {
    assert.equal((await call(env, '/admin/api/nodes', 'POST', { ...sample, quantity }, cookie)).status, 400, String(quantity));
  }
  assert.equal((await (await call(env, '/api/status')).json()).nodes.length, 0);
});

test('删除线路组同时清理对应数量，不影响其他组', async () => {
  const { env, sqlite } = await fixture(), cookie = await login(env), ids = [];
  for (const quantity of [10, 20]) ids.push((await (await call(env, '/admin/api/nodes', 'POST', { ...sample, quantity }, cookie)).json()).id);
  assert.equal((await call(env, '/admin/api/nodes/' + ids[0], 'DELETE', undefined, cookie)).status, 200);
  assert.equal(sqlite.prepare('SELECT value FROM metadata WHERE key = ?').get('node_quantity:' + ids[0]), undefined);
  const data = await (await call(env, '/api/status')).json();
  assert.equal(data.nodes.length, 1); assert.equal(data.nodes[0].id, ids[1]); assert.equal(data.nodes[0].quantity, 20);
});

test('节点与数量的保存使用同一事务，数量写入失败时回滚', async () => {
  const { env, sqlite } = await fixture(), cookie = await login(env);
  sqlite.exec("CREATE TRIGGER reject_quantity BEFORE INSERT ON metadata WHEN NEW.key LIKE 'node_quantity:%' BEGIN SELECT RAISE(ABORT, 'test rejection'); END;");
  const response = await call(env, '/admin/api/nodes', 'POST', { ...sample, quantity: 10 }, cookie);
  assert.equal(response.status, 503);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM nodes').get().total, 0);
});
