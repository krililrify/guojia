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

test('支持数量包含全部记录，不受历史可用或故障标记影响', async () => {
  const { coverageOf } = await import('../public/status-model.js');
  const result = coverageOf(groups);
  assert.equal(result.total, 17);
  assert.deepEqual(result.regions.map(region => [region.country, region.total]), [['SG', 12], ['JP', 5]]);
  const changed = groups.map(group => ({ ...group, status: group.status === 'available' ? 'outage' : 'available' }));
  const after = coverageOf(changed);
  assert.equal(after.total, result.total);
  assert.deepEqual(after.regions.map(region => [region.country, region.total]), result.regions.map(region => [region.country, region.total]));
});

test('全部为旧故障标记的国家仍列为支持，数量按VIP归属统计', async () => {
  const { coverageOf } = await import('../public/status-model.js');
  const records = [{ country: 'JP', quantity: 10, status: 'outage', tiers: [3], name: '日本', note: '' }];
  assert.equal(coverageOf(filterGroups(records, '3', '', countryName)).regions[0].total, 10);
  assert.equal(coverageOf(filterGroups(records, '1', '', countryName)).regions.length, 0);
  assert.deepEqual(coverageOf([]), { total: 0, regions: [] });
});

test('高等级自动继承低等级的国家与数量，多选旧记录不会重复计算', async () => {
  const { groupsForTier, coverageOf } = await import('../public/status-model.js');
  const records = [
    { country: 'JP', quantity: 1, tiers: [1, 3] },
    { country: 'JP', quantity: 5, tiers: [1] },
    { country: 'JP', quantity: 3, tiers: [2] },
    { country: 'SG', quantity: 5, tiers: [1, 2, 3] }
  ];
  assert.equal(coverageOf(groupsForTier(records, 1)).total, 11);
  assert.equal(coverageOf(groupsForTier(records, 2)).total, 14);
  assert.equal(coverageOf(groupsForTier(records, 3)).total, 14);
  assert.equal(groupsForTier(records, 3).length, 4);
  assert.equal(coverageOf(groupsForTier(records, 2)).regions.find(x => x.country === 'JP').total, 9);
});

test('VIP2专属地区被VIP3继承，不会进入VIP1', async () => {
  const { groupsForTier, coverageOf } = await import('../public/status-model.js');
  const records = [
    { country: 'JP', quantity: 5, tiers: [1] },
    { country: 'US', quantity: 3, tiers: [2] },
    { country: 'VN', quantity: 2, tiers: [2] },
    { country: 'SG', quantity: 8, tiers: [3] }
  ];
  assert.deepEqual(coverageOf(groupsForTier(records, 1)).regions.map(x => x.country), ['JP']);
  assert.deepEqual(coverageOf(groupsForTier(records, 2)).regions.map(x => x.country), ['JP', 'US', 'VN']);
  assert.deepEqual(coverageOf(groupsForTier(records, 3)).regions.map(x => x.country), ['JP', 'US', 'VN', 'SG']);
});

test('最低等级兼容旧多选记录，不修改其原始VIP归属', async () => {
  const { groupsForTier, minimumTierOf } = await import('../public/status-model.js');
  const records = [{ tiers: [3, 1, 2] }, { tiers: [3, 2] }, { tiers: [3] }];
  const before = JSON.stringify(records);
  assert.deepEqual(records.map(minimumTierOf), [1, 2, 3]);
  assert.equal(groupsForTier(records, '2').length, 2);
  assert.deepEqual(groupsForTier(records, 0), []);
  assert.deepEqual(groupsForTier(records, 4), []);
  assert.equal(JSON.stringify(records), before);
});
