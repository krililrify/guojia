import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantityOf, summarize, groupByCountry, filterGroups, numberLabel } from '../public/status-model.js';
import { countryName } from '../public/countries.js';
const groups = [
  { country: 'SG', name: '狮城普通线路', quantity: 10, status: 'available', tiers: [1, 2, 3], note: '' },
  { country: 'SG', name: '狮城备用线路', quantity: 2, status: 'outage', tiers: [3], note: '维护中' },
  { country: 'JP', name: '东京线路', quantity: 5, status: 'available', tiers: [2, 3], note: '' }
];
test('同一国家合为一张卡片，统计数量而非记录条数', () => {
  const countries = groupByCountry(groups);
  assert.equal(countries.length, 2);
  assert.equal(countries[0].country, 'SG'); assert.equal(countries[0].groups.length, 2);
  assert.equal(countries[0].total, 12); assert.equal(countries[0].available, 10); assert.equal(countries[0].outage, 2);
  assert.deepEqual(summarize(groups), { total: 17, available: 15, outage: 2 });
});
test('先筛选VIP，统计只包含该套餐可用的组及数量', () => {
  assert.deepEqual(summarize(filterGroups(groups, '1', '', countryName)), { total: 10, available: 10, outage: 0 });
  assert.deepEqual(summarize(filterGroups(groups, '2', '', countryName)), { total: 15, available: 15, outage: 0 });
  assert.deepEqual(summarize(filterGroups(groups, '3', '', countryName)), { total: 17, available: 15, outage: 2 });
});
test('搜索支持国家、代码、组名及备注', () => {
  assert.equal(filterGroups(groups, 'all', '新加坡', countryName).length, 2);
  assert.equal(filterGroups(groups, 'all', 'sg', countryName).length, 2);
  assert.equal(filterGroups(groups, 'all', '东京', countryName).length, 1);
  assert.equal(filterGroups(groups, 'all', '维护', countryName).length, 1);
  assert.equal(filterGroups(groups, '1', '备用', countryName).length, 0);
});
test('兼容无数量的旧数据，编号从01显示并支持三位数字', () => {
  assert.equal(quantityOf({}), 1); assert.equal(quantityOf({ quantity: 10 }), 10);
  assert.deepEqual(summarize([{ status: 'available' }]), { total: 1, available: 1, outage: 0 });
  assert.deepEqual([1, 2, 9, 10, 100].map(numberLabel), ['01', '02', '09', '10', '100']);
});
