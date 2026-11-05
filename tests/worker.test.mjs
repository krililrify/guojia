import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { fixture } from './helpers.mjs';
import { flag, countryName } from '../public/countries.js';
const origin = 'https://status.example.com';
function call(env, path, method = 'GET', body, cookie, extraHeaders = {}) {
  return worker.fetch(new Request(origin + path, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
}
async function login(env) {
  const response = await call(env, env.ADMIN_PATH + '/api/login', 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
  assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie'), /HttpOnly; SameSite=Strict.*Secure/);
  return response.headers.get('Set-Cookie').split(';')[0];
}
const sample = { country: 'JP', name: '日本 · 东京 01', status: 'available', tiers: [1, 3], note: '人工维护', sort_order: 0 };
test('公开页面、后台路径和源码访问隔离', async () => {
  const { env } = await fixture();
  for (const path of ['/', '/app.js', '/countries.js', '/styles.css', env.ADMIN_PATH, env.ADMIN_PATH + '/']) assert.equal((await call(env, path)).status, 200, path);
  for (const path of ['/admin.html', '/_worker.js', '/wrangler.toml', '/.dev.vars', '/wrong', '/private/control-extra']) assert.equal((await call(env, path)).status, 404, path);
  const response = await call(env, '/'); assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('首次部署没有虚构节点', async () => {
  const { env } = await fixture(); const response = await call(env, '/api/status');
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { nodes: [], updated_at: null });
});
test('未登录、伪造会话不可增删改', async () => {
  const { env } = await fixture(); const base = env.ADMIN_PATH + '/api';
  for (const [path, method, data] of [[base + '/nodes', 'POST', sample], [base + '/nodes/00000000-0000-0000-0000-000000000000', 'DELETE'], [base + '/nodes', 'GET']]) {
    assert.equal((await call(env, path, method, data, 'guojia_session=1999999999.' + '0'.repeat(64))).status, 401);
  }
});
test('登录、创建、更新、公开同步、删除完整流程', async () => {
  const { env } = await fixture(), cookie = await login(env), base = env.ADMIN_PATH + '/api';
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
  const { env } = await fixture(), cookie = await login(env), base = env.ADMIN_PATH + '/api';
  assert.equal((await call(env, base + '/nodes', 'POST', sample, cookie, { Origin: 'https://attacker.example' })).status, 403);
  const request = new Request(origin + base + '/nodes', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify(sample) });
  assert.equal((await worker.fetch(request, env)).status, 403);
});
test('字段、国家、套餐和请求体大小校验', async () => {
  const { env } = await fixture(), cookie = await login(env), path = env.ADMIN_PATH + '/api/nodes';
  for (const data of [null, { ...sample, country: 'ZZ' }, { ...sample, tiers: [] }, { ...sample, tiers: [4] }, { ...sample, name: '' }, { ...sample, name: 'a'.repeat(61) }, { ...sample, note: 'x'.repeat(201) }, { ...sample, sort_order: 0.5 }, { ...sample, status: 'unknown' }, { ...sample, id: "'; DROP TABLE nodes; --" }, { ...sample, note: 'a'.repeat(17000) }]) assert.equal((await call(env, path, 'POST', data, cookie)).status, 400);
});
test('密码错误与登录限速', async () => {
  const { env } = await fixture(), path = env.ADMIN_PATH + '/api/login';
  for (let i = 0; i < 10; i++) assert.equal((await call(env, path, 'POST', { username: 'owner', password: 'wrong' })).status, 401);
  const limited = await call(env, path, 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }); assert.equal(limited.status, 429); assert.ok(limited.headers.get('Retry-After'));
});
test('修改密码会使原会话失效，退出清除 cookie', async () => {
  const { env } = await fixture(), cookie = await login(env), base = env.ADMIN_PATH + '/api';
  const logout = await call(env, base + '/logout', 'POST', {}, cookie); assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  env.ADMIN_PASSWORD = 'another-long-test-password-123';
  assert.equal((await call(env, base + '/session', 'GET', undefined, cookie)).status, 401);
});
test('后台配置和数据库缺失时明确报错', async () => {
  const { env } = await fixture();
  assert.equal((await call({ ...env, DB: undefined }, '/api/status')).status, 503);
  assert.equal((await call({ ...env, ADMIN_PASSWORD: 'short' }, env.ADMIN_PATH)).status, 503);
  assert.equal((await call({ ...env, ADMIN_PATH: '/api' }, '/api')).status, 404);
});
test('自动国旗和中文国家名称', () => { assert.equal(flag('JP'), '🇯🇵'); assert.equal(flag('HK'), '🇭🇰'); assert.equal(flag('ZZ'), '🌐'); assert.equal(countryName('JP'), '日本'); });
