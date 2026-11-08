export const DEFAULT_VIP_CARDS = [
  { tier: 1, tagline: '轻量入门', devices: '1', device_note: '全平台通用', service_enabled: false, service_label: 'AI 与流媒体', service_names: 'Gemini / ChatGPT / Netflix', platforms: 'Windows / iOS / Android / Mac' },
  { tier: 2, tagline: '多设备连接', devices: '2', device_note: '全平台通用', service_enabled: false, service_label: 'AI 与流媒体', service_names: 'Gemini / ChatGPT / Netflix', platforms: 'Windows / iOS / Android / Mac' },
  { tier: 3, tagline: 'AI 与流媒体', devices: '3–4', device_note: '300GB 套餐支持 4 台', service_enabled: true, service_label: 'AI 与流媒体', service_names: 'Gemini / ChatGPT / Netflix', platforms: 'Windows / iOS / Android / Mac' }
];
export function validateCards(value) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('必须提交 VIP1、VIP2、VIP3 三档权益');
  return [1, 2, 3].map(tier => {
    const matches = value.filter(card => card?.tier === tier);
    if (matches.length !== 1) throw new Error('每个 VIP 等级必须且只能出现一次');
    const card = matches[0], result = { tier };
    for (const [field, limit, required] of [['tagline', 30, true], ['devices', 20, true], ['device_note', 100, false], ['service_label', 50, true], ['service_names', 150, false], ['platforms', 150, false]]) {
      if (typeof card[field] !== 'string' || card[field].length > limit || (required && !card[field].trim())) throw new Error(`VIP${tier} 的 ${field} 格式无效（最多 ${limit} 字符）`);
      result[field] = card[field].trim();
    }
    if (!/^\d{1,3}(?:[–-]\d{1,3})?$/.test(result.devices)) throw new Error(`VIP${tier} 的设备数请填写数字或范围，如 1、3–4`);
    const bounds = result.devices.split(/[–-]/).map(Number);
    if (bounds.some(number => number < 1) || (bounds.length === 2 && bounds[0] > bounds[1])) throw new Error('设备数量应为正数，范围从小到大填写');
    if (typeof card.service_enabled !== 'boolean') throw new Error('支持服务状态必须为布尔值');
    result.service_enabled = card.service_enabled;
    return result;
  });
}
export function readCards(stored) {
  if (stored) try { return validateCards(JSON.parse(stored)); } catch { /* 兼容尚未配置或旧版数据 */ }
  return DEFAULT_VIP_CARDS.map(card => ({ ...card }));
}
