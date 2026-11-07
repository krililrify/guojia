// 一条记录代表一个国家下的线路组；旧记录无数量时视为 1 个节点。
export function quantityOf(group) {
  return Number.isInteger(group.quantity) && group.quantity >= 1 && group.quantity <= 200 ? group.quantity : 1;
}
export function summarize(groups) {
  return groups.reduce((counts, group) => {
    const quantity = quantityOf(group);
    counts.total += quantity;
    counts[group.status === 'available' ? 'available' : 'outage'] += quantity;
    return counts;
  }, { total: 0, available: 0, outage: 0 });
}
export function groupByCountry(groups) {
  const countries = new Map();
  for (const group of groups) {
    if (!countries.has(group.country)) countries.set(group.country, []);
    countries.get(group.country).push(group);
  }
  return [...countries].map(([country, items]) => ({ country, groups: items, ...summarize(items) }));
}
export function filterGroups(groups, tier, query, countryName) {
  const search = query.trim().toLowerCase();
  return groups.filter(group => (tier === 'all' || group.tiers.includes(Number(tier))) && `${countryName(group.country)} ${group.country} ${group.name} ${group.note}`.toLowerCase().includes(search));
}
export const numberLabel = number => String(number).padStart(2, '0');
