import { codes, countryName, flag } from './countries.js';
const $ = selector => document.querySelector(selector);
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
function notice(message = '', success = false) { const node = $('#notice'); node.textContent = message; node.hidden = !message; node.classList.toggle('success', success); }
function date(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚无状态更新'; }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
  let data; try { data = await response.json(); } catch { throw new Error('服务响应异常，请稍后重试'); }
  if (!response.ok) { const error = new Error(data.error || '操作失败'); error.status = response.status; throw error; }
  return data;
}
const badges = tiers => { const group = element('div', 'node-bottom'); for (const tier of tiers) group.append(element('span', 'badge', `VIP${tier}`)); return group; };
if (document.body.dataset.view === 'public') {
  let nodes = [], updatedAt = null, tier = new URLSearchParams(location.search).get('vip') || 'all', loaded = false, busy = false;
  if (!['1', '2', '3'].includes(tier)) tier = 'all';
  function render() {
    document.querySelectorAll('[data-tier]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tier === tier)));
    const query = $('#search').value.trim().toLowerCase();
    const inTier = nodes.filter(n => tier === 'all' || n.tiers.includes(Number(tier)));
    const visible = inTier.filter(n => `${countryName(n.country)} ${n.country} ${n.name} ${n.note}`.toLowerCase().includes(query));
    const failures = inTier.filter(n => n.status === 'outage').length;
    $('.overview').classList.toggle('has-outage', failures > 0);
    $('.overview').classList.toggle('is-empty', !inTier.length);
    $('#overview-icon').textContent = !inTier.length ? '—' : failures ? '!' : '✓';
    $('#overview-title').textContent = !inTier.length ? '暂无已发布节点' : failures ? '部分节点服务异常' : '所有节点运行正常';
    $('#overview-description').textContent = !inTier.length ? '管理员尚未为此套餐发布节点信息' : `${tier === 'all' ? '全部套餐' : 'VIP' + tier} · ${inTier.length - failures} 个可用节点${failures ? `，${failures} 个节点故障` : '，连接状态良好'}`;
    $('#count').textContent = `${visible.length} 个节点 · ${new Set(visible.map(n => n.country)).size} 个国家与地区`;
    $('#updated').textContent = updatedAt ? '最近更新：' + date(updatedAt) : '尚无状态更新';
    const grid = $('#node-grid'); grid.replaceChildren();
    for (const n of visible) {
      const card = element('article', 'node-card'), top = element('div', 'node-card-top'), info = element('div');
      info.append(element('div', 'node-title', n.name), element('div', 'country-label', countryName(n.country)));
      const status = element('div', 'status'); status.append(element('i', 'dot ' + n.status), document.createTextNode(n.status === 'available' ? '可用' : '故障'));
      top.append(element('span', 'flag', flag(n.country)), info, status); card.append(top, badges(n.tiers));
      if (n.note) card.append(element('p', 'note', n.note)); grid.append(card);
    }
    if (!visible.length) grid.append(element('div', 'empty', query ? '没有找到匹配的国家或节点，请调整搜索条件。' : '暂无节点，管理员发布后将在这里显示。'));
  }
  async function refresh() {
    if (busy) return; busy = true; $('#refresh').disabled = true;
    try { const result = await api('/api/status'); nodes = result.nodes; updatedAt = result.updated_at; loaded = true; notice(); render(); $('#checked').textContent = '检查于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }); }
    catch (error) { notice((loaded ? '刷新失败，当前显示上次成功获取的状态。' : '无法加载节点状态。') + error.message); if (!loaded) { $('#overview-title').textContent = '暂时无法获取状态'; $('#overview-description').textContent = '请稍后点击刷新重试'; $('#overview-icon').textContent = '!'; $('.overview').classList.add('is-empty'); $('#count').textContent = '状态未知'; } }
    finally { busy = false; $('#refresh').disabled = false; }
  }
  document.querySelectorAll('[data-tier]').forEach(button => button.addEventListener('click', () => { tier = button.dataset.tier; const url = new URL(location.href); if (tier === 'all') url.searchParams.delete('vip'); else url.searchParams.set('vip', tier); history.replaceState(null, '', url); if (loaded) render(); else document.querySelectorAll('[data-tier]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tier === tier))); }));
  $('#search').addEventListener('input', () => { if (loaded) render(); }); $('#refresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 30000); refresh();
} else {
  const base = location.pathname.replace(/\/+$/, '') + '/api';
  const form = $('#node-form'); let nodes = [], mutating = false;
  const countryLabel = code => `${countryName(code)} · ${code}`;
  const sorted = [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b), 'zh-CN'));
  for (const code of sorted) { const option = element('option'); option.value = countryLabel(code); option.label = flag(code) + ' ' + countryName(code); $('#country-options').append(option); }
  function resolveCountry(value) { return codes.find(code => value.trim().toUpperCase() === code || value.trim() === countryName(code) || value.trim() === countryLabel(code)); }
  $('#country').addEventListener('change', () => { const code = resolveCountry($('#country').value); if (code) { $('#country').value = countryLabel(code); if (!form.elements.name.value.trim()) form.elements.name.value = countryName(code) + ' 01'; } });
  function showLogin() { $('#login-panel').hidden = false; $('#admin-panel').hidden = true; nodes = []; $('#admin-nodes').replaceChildren(); form.reset(); }
  function reset() { form.reset(); form.elements.id.value = ''; $('#editor-title').textContent = '添加节点'; }
  async function load() {
    const data = await api(base + '/nodes'); nodes = data.nodes;
    $('#login-panel').hidden = true; $('#admin-panel').hidden = false; $('#admin-count').textContent = `(${nodes.length})`;
    const list = $('#admin-nodes'); list.replaceChildren();
    for (const node of nodes) {
      const item = element('article', 'admin-node'), head = element('div', 'admin-node-head');
      head.append(element('span', 'flag', flag(node.country)), element('strong', '', node.name)); item.append(head);
      const info = element('p', '', `${countryName(node.country)} · 排序 ${node.sort_order} · ${date(node.updated_at)}`); item.append(info);
      const tags = badges(node.tiers); tags.className = ''; item.append(tags);
      if (node.note) item.append(element('p', '', node.note));
      const actions = element('div', 'admin-node-actions');
      const toggle = element('button', 'secondary'); toggle.type = 'button'; toggle.append(element('i', 'dot ' + node.status), document.createTextNode(node.status === 'available' ? ' 可用 · 切为故障' : ' 故障 · 切为可用'));
      toggle.addEventListener('click', () => mutate(async () => { await api(base + '/nodes', { method: 'POST', body: JSON.stringify({ ...node, status: node.status === 'available' ? 'outage' : 'available' }) }); }, '状态已更新'));
      const edit = element('button', 'secondary', '编辑'); edit.type = 'button'; edit.addEventListener('click', () => {
        reset(); for (const key of ['id', 'name', 'note', 'sort_order']) form.elements[key].value = node[key];
        $('#country').value = countryLabel(node.country); form.elements.status.value = node.status;
        form.querySelectorAll('[name=tiers]').forEach(input => { input.checked = node.tiers.includes(Number(input.value)); });
        $('#editor-title').textContent = '编辑节点'; $('.editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); form.elements.name.focus({ preventScroll: true });
      });
      const remove = element('button', 'secondary danger', '删除'); remove.type = 'button'; remove.addEventListener('click', () => { if (confirm(`确定删除“${node.name}”？此操作无法撤销。`)) mutate(async () => { await api(base + '/nodes/' + node.id, { method: 'DELETE' }); if (form.elements.id.value === node.id) reset(); }, '节点已删除'); });
      actions.append(toggle, edit, remove); item.append(actions); list.append(item);
    }
    if (!nodes.length) list.append(element('div', 'empty', '还没有节点，从左侧添加第一个国家或节点。'));
  }
  function handleError(error) { if (error.status === 401) showLogin(); notice(error.message); }
  async function mutate(operation, message) {
    if (mutating) return; mutating = true;
    $('#admin-panel').querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { await operation(); notice(message, true); try { await load(); } catch (error) { if (error.status === 401) showLogin(); notice(message + '，但列表刷新失败，请点击刷新。' + error.message); } }
    catch (error) { handleError(error); }
    finally { mutating = false; $('#admin-panel').querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { const data = new FormData(event.target); await api(base + '/login', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) }); event.target.elements.password.value = ''; notice(); await load(); }
    catch (error) { handleError(error); } finally { button.disabled = false; }
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(form), country = resolveCountry(data.get('country'));
    if (!country) { notice('请从建议列表选择国家 / 地区，或填写两位代码，如 JP。'); return; }
    const tiers = data.getAll('tiers').map(Number); if (!tiers.length) { notice('请至少选择一个适用套餐。'); return; }
    const node = { country, name: data.get('name'), status: data.get('status'), tiers, note: data.get('note'), sort_order: Number(data.get('sort_order')) };
    if (data.get('id')) node.id = data.get('id');
    mutate(async () => { await api(base + '/nodes', { method: 'POST', body: JSON.stringify(node) }); reset(); }, '节点已保存，前台将在下一次刷新时显示');
  });
  $('#reset-form').addEventListener('click', reset);
  $('#reload-admin').addEventListener('click', async () => { try { await load(); notice(); } catch (error) { handleError(error); } });
  $('#logout').addEventListener('click', async () => { try { await api(base + '/logout', { method: 'POST', body: '{}' }); reset(); showLogin(); notice('已退出登录', true); } catch (error) { handleError(error); } });
  try { await api(base + '/session'); await load(); } catch (error) { if (error.status !== 401) notice(error.message); }
}
