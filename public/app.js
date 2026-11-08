import { codes, countryName, flag } from './countries.js';
import { quantityOf, summarize, coverageOf, groupsForTier, minimumTierOf } from './status-model.js';
const $ = selector => document.querySelector(selector);
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
function notice(message = '', success = false) { const node = $('#notice'); node.textContent = message; node.hidden = !message; node.classList.toggle('success', success); }
function date(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未更新'; }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
  let data; try { data = await response.json(); } catch { throw new Error('服务响应异常，请稍后重试'); }
  if (!response.ok) { const error = new Error(data.error || '操作失败'); error.status = response.status; throw error; }
  return data;
}
const badges = tiers => { const group = element('div', 'node-bottom'); group.append(element('span', 'badge', `VIP${minimumTierOf({ tiers })} 起`)); return group; };
if (document.body.dataset.view === 'public') {
  let nodes = [], loaded = false, busy = false;
  const linkedTier = new URLSearchParams(location.search).get('vip');
  if (['1', '2', '3'].includes(linkedTier)) $('#vip' + linkedTier).classList.add('linked-tier');
  function renderComparison() {
    for (const tier of [1, 2, 3]) {
      const groups = groupsForTier(nodes, tier), coverage = coverageOf(groups), countries = coverage.regions;
      $('#vip' + tier + '-summary').textContent = groups.length ? `支持 ${coverage.total} 个节点` : '暂无已发布节点';
      $('#vip' + tier + '-region-count').textContent = `${countries.length} 个地区`;
      const regions = $('#vip' + tier + '-regions'); regions.replaceChildren();
      for (const country of countries) {
        const row = element('div', 'vip-region');
        const name = element('span', 'vip-region-name'); name.append(element('span', 'region-flag', flag(country.country)), document.createTextNode(countryName(country.country)));
        const state = element('span', 'region-state support-text', `支持 ${country.total} 个`);
        row.append(name, state); regions.append(row);
      }
      if (!countries.length) regions.append(element('p', 'regions-placeholder', '地区待发布'));
    }
  }
  async function refresh() {
    if (busy) return; busy = true;
    try { const result = await api('/api/status'); nodes = result.nodes; loaded = true; notice(); renderComparison(); }
    catch (error) {
      notice((loaded ? '数据更新暂缓，当前展示上次获取的支持范围。' : '暂时无法加载节点信息。') + error.message);
      if (!loaded) for (const tier of [1, 2, 3]) {
        $('#vip' + tier + '-summary').textContent = '节点信息暂不可用';
        $('#vip' + tier + '-region-count').textContent = '';
        $('#vip' + tier + '-regions').replaceChildren(element('p', 'regions-placeholder', '请稍后重新访问'));
      }
    } finally { busy = false; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 30000); refresh();
} else {
  const base = '/admin/api';
  const form = $('#node-form'); let nodes = [], mutating = false;
  const countryLabel = code => `${countryName(code)} · ${code}`;
  const sorted = [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b), 'zh-CN'));
  for (const code of sorted) { const option = element('option'); option.value = countryLabel(code); option.label = flag(code) + ' ' + countryName(code); $('#country-options').append(option); }
  function resolveCountry(value) { return codes.find(code => value.trim().toUpperCase() === code || value.trim() === countryName(code) || value.trim() === countryLabel(code)); }
  $('#country').addEventListener('change', () => { const code = resolveCountry($('#country').value); if (code) { $('#country').value = countryLabel(code); if (!form.elements.name.value.trim()) form.elements.name.value = countryName(code) + '线路'; } });
  function showLogin() { $('#login-panel').hidden = false; $('#admin-panel').hidden = true; nodes = []; $('#admin-nodes').replaceChildren(); form.reset(); }
  function reset() { form.reset(); form.elements.id.value = ''; $('#editor-title').textContent = '添加线路组'; }
  async function load() {
    const data = await api(base + '/nodes'); nodes = data.nodes;
    $('#login-panel').hidden = true; $('#admin-panel').hidden = false; $('#admin-count').textContent = `(${nodes.length} 组 / ${summarize(nodes).total} 个节点)`;
    const list = $('#admin-nodes'); list.replaceChildren();
    for (const node of nodes) {
      const item = element('article', 'admin-node'), head = element('div', 'admin-node-head');
      head.append(element('span', 'flag', flag(node.country)), element('strong', '', node.name)); item.append(head);
      const info = element('p', '', `${countryName(node.country)} · 数量 ${quantityOf(node)} · 排序 ${node.sort_order} · ${date(node.updated_at)}`); item.append(info);
      const tags = badges(node.tiers); tags.className = ''; item.append(tags);
      if (node.note) item.append(element('p', '', node.note));
      const actions = element('div', 'admin-node-actions');
      const edit = element('button', 'secondary', '编辑'); edit.type = 'button'; edit.addEventListener('click', () => {
        reset(); for (const key of ['id', 'name', 'note', 'sort_order']) form.elements[key].value = node[key];
        form.elements.quantity.value = quantityOf(node);
        $('#country').value = countryLabel(node.country); form.elements.status.value = node.status;
        form.elements.tiers.value = minimumTierOf(node);
        $('#editor-title').textContent = '编辑线路组'; $('.editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); form.elements.name.focus({ preventScroll: true });
      });
      const remove = element('button', 'secondary danger', '删除'); remove.type = 'button'; remove.addEventListener('click', () => { if (confirm(`确定删除“${node.name}”整组 ${quantityOf(node)} 个节点？此操作无法撤销。`)) mutate(async () => { await api(base + '/nodes/' + node.id, { method: 'DELETE' }); if (form.elements.id.value === node.id) reset(); }, '线路组已删除'); });
      actions.append(edit, remove); item.append(actions); list.append(item);
    }
    if (!nodes.length) list.append(element('div', 'empty', '还没有线路组，选择国家并填写数量，即可一次添加多个节点。'));
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
    const tiers = data.getAll('tiers').map(Number); if (!tiers.length) { notice('请选择最低支持套餐。'); return; }
    const node = { country, name: data.get('name'), status: data.get('status'), tiers, note: data.get('note'), sort_order: Number(data.get('sort_order')), quantity: Number(data.get('quantity')) };
    if (data.get('id')) node.id = data.get('id');
    mutate(async () => { await api(base + '/nodes', { method: 'POST', body: JSON.stringify(node) }); reset(); }, '线路组和数量已保存，前台将在下一次刷新时显示');
  });
  $('#reset-form').addEventListener('click', reset);
  $('#reload-admin').addEventListener('click', async () => { try { await load(); notice(); } catch (error) { handleError(error); } });
  $('#logout').addEventListener('click', async () => { try { await api(base + '/logout', { method: 'POST', body: '{}' }); reset(); showLogin(); notice('已退出登录', true); } catch (error) { handleError(error); } });
  try { await api(base + '/session'); await load(); } catch (error) { if (error.status !== 401) notice(error.message); }
}
