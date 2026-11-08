import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { fixture } from './helpers.mjs';
import { DEFAULT_VIP_CARDS, readCards } from '../public/vip-config.js';
const origin = 'https://status.example.com';
const clone = () => structuredClone(DEFAULT_VIP_CARDS);
async function request(env, path, method = 'GET', payload, cookie, requestOrigin = origin) {
  return worker.fetch(new Request(origin + path, { method, headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }), env);
}
async function session(env) {
  const res = await request(env, '/admin/api/login', 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
  assert.equal(res.status, 200); return res.headers.get('Set-Cookie').split(';')[0];
}
test('无配置的旧数据库自动展示默认权益，不写入或重建数据库', async () => {
  const { env, sqlite } = await fixture();
  const before = sqlite.prepare('SELECT * FROM metadata ORDER BY key').all();
  const result = await (await request(env, '/api/status')).json();
  assert.deepEqual(result.cards, DEFAULT_VIP_CARDS);
  assert.deepEqual(sqlite.prepare('SELECT * FROM metadata ORDER BY key').all(), before);
});
test('后台设置只有登录后可读取和保存，并拒绝跨站提交', async () => {
  const { env } = await fixture();
  assert.equal((await request(env, '/admin/api/settings')).status, 401);
  assert.equal((await request(env, '/admin/api/settings', 'PUT', { cards: clone() })).status, 401);
  const cookie = await session(env);
  assert.equal((await request(env, '/admin/api/settings', 'PUT', { cards: clone() }, cookie, 'https://attacker.example')).status, 403);
});
test('修改设备数和服务后，后台重读与公开接口同步，节点保持不变', async () => {
  const { env, sqlite } = await fixture(), cookie = await session(env);
  await request(env, '/admin/api/nodes', 'POST', { country: 'JP', name: '日本', status: 'available', tiers: [1], quantity: 10, sort_order: 0, note: '' }, cookie);
  const before = sqlite.prepare('SELECT * FROM nodes').all();
  const cards = clone(); cards[0].devices = '5'; cards[0].device_note = '新设备限制'; cards[1].service_enabled = true; cards[1].service_label = '指定服务';
  const saved = await request(env, '/admin/api/settings', 'PUT', { cards }, cookie);
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).cards, cards);
  assert.deepEqual((await (await request(env, '/admin/api/settings', 'GET', undefined, cookie)).json()).cards, cards);
  const data = await (await request(env, '/api/status')).json();
  assert.deepEqual(data.cards, cards); assert.equal(data.nodes[0].quantity, 10); assert.ok(data.updated_at);
  assert.deepEqual(sqlite.prepare('SELECT * FROM nodes').all(), before);
});
test('无效设备数、缺失或重复等级、过长文案不能覆盖已保存配置', async () => {
  const { env } = await fixture(), cookie = await session(env);
  const valid = clone(); await request(env, '/admin/api/settings', 'PUT', { cards: valid }, cookie);
  const invalid = [[], valid.slice(1), [valid[0], valid[0], valid[2]], null];
  for (const change of [{ devices: '0' }, { devices: '4–2' }, { devices: '1000' }, { devices: '无限' }, { service_enabled: 'true' }, { tagline: '' }, { device_note: 'a'.repeat(101) }]) {
    const cards = clone(); Object.assign(cards[0], change); invalid.push(cards);
  }
  for (const cards of invalid) assert.equal((await request(env, '/admin/api/settings', 'PUT', { cards }, cookie)).status, 400);
  assert.deepEqual((await (await request(env, '/api/status')).json()).cards, valid);
});
test('可清空选填说明，整数和范围设备数均可保存', async () => {
  const { env } = await fixture(), cookie = await session(env), cards = clone();
  cards[0].device_note = ''; cards[0].service_names = ''; cards[0].platforms = ''; cards[2].devices = '4-8';
  assert.equal((await request(env, '/admin/api/settings', 'PUT', { cards }, cookie)).status, 200);
  assert.deepEqual((await (await request(env, '/api/status')).json()).cards, cards);
});
test('配置写入异常时不留下部分更新', async () => {
  const { env, sqlite } = await fixture(), cookie = await session(env);
  const before = sqlite.prepare('SELECT * FROM metadata ORDER BY key').all();
  sqlite.exec("CREATE TRIGGER block_settings BEFORE INSERT ON metadata WHEN NEW.key = 'vip_card_settings' BEGIN SELECT RAISE(ABORT, 'test settings rejection'); END;");
  assert.equal((await request(env, '/admin/api/settings', 'PUT', { cards: clone() }, cookie)).status, 503);
  assert.deepEqual(sqlite.prepare('SELECT * FROM metadata ORDER BY key').all(), before);
});
test('旧配置为空或损坏时回退默认文案，默认对象不被调用方修改', () => {
  for (const value of [null, '', '{invalid', '[]']) assert.deepEqual(readCards(value), DEFAULT_VIP_CARDS);
  const cards = readCards(null); cards[0].devices = '99'; assert.equal(DEFAULT_VIP_CARDS[0].devices, '1');
});
