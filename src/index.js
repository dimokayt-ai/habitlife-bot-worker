const ADMINS_DEFAULT = ['7001764913','8634323012'];
async function tg(env, method, body) {
  const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return r.json();
}
const norm = e => String(e || '').trim().toLowerCase();
const kb = u => ({ inline_keyboard: [
  [{ text: u.role === 'admin' ? 'Снять админ' : 'Выдать админ', callback_data: 'role:' + u.email + ':' + (u.role === 'admin' ? 'user' : 'admin') }],
  [{ text: u.blocked ? 'Разблокировать' : 'Заблокировать', callback_data: 'block:' + u.email + ':' + (u.blocked ? 0 : 1) }],
  [{ text: 'Лимит 50', callback_data: 'limit:' + u.email + ':50' }, { text: 'Лимит 200', callback_data: 'limit:' + u.email + ':200' }],
  [{ text: 'Удалить', callback_data: 'del:' + u.email }],
  [{ text: '« К списку', callback_data: 'users:0' }]
]});
const card = u => '👤 <b>' + u.email + '</b>\nРоль: ' + (u.role === 'admin' ? '🛡 admin' : 'user') +
  '\nСтатус: ' + (u.blocked ? '⛔ заблокирован' : '✅ активен') + '\nСканирования: ' + (u.scans_used || 0) + '/' + (u.scans_limit || 6);
async function getUsers(env) { return JSON.parse((await env.HL_DATA.get('users')) || '{}'); }
async function saveUsers(env, users) { await env.HL_DATA.put('users', JSON.stringify(users)); }
function admins(env) { return (env.ADMIN_TG_IDS || ADMINS_DEFAULT.join(',')).split(',').map(s => s.trim()); }
function ensure(users, e) { e = norm(e); if (!users[e]) users[e] = { email: e, name: '', role: 'user', blocked: false, scans_limit: 6, scans_used: 0 }; return users[e]; }
async function send(env, chat, text, extra = {}) {
  return tg(env, 'sendMessage', Object.assign({ chat_id: chat, text: text, parse_mode: 'HTML' }, extra));
}
async function edit(env, chat, mid, text, extra = {}) {
  return tg(env, 'editMessageText', Object.assign({ chat_id: chat, message_id: mid, text: text, parse_mode: 'HTML' }, extra));
}
async function handleMessage(env, m) {
  const chat = m.chat.id, text = (m.text || '').trim();
  if (!admins(env).includes(String(m.from.id))) return send(env, chat, 'Доступ только для администратора бота.');
  const users = await getUsers(env);
  if (text.startsWith('/start')) {
    await saveUsers(env, users);
    return send(env, chat, 'HabitLife Admin Panel', { reply_markup: { inline_keyboard: [
      [{ text: '🌐 Открыть панель', web_app: { url: env.WEBAPP_URL || 'https://dimokayt-ai.github.io/habitlife-admin-web/' } }],
      [{ text: '👥 Пользователи', callback_data: 'users:0' }, { text: '🔍 Поиск', callback_data: 'search' }],
      [{ text: '📊 Статистика', callback_data: 'stats' }]
    ] } });
  }
  if (text.startsWith('/users')) {
    const rows = Object.values(users).slice(0, 10).map(u => [{ text: (u.role === 'admin' ? '🛡 ' : '• ') + u.email, callback_data: 'card:' + u.email }]);
    rows.push([{ text: '🔍 Поиск', callback_data: 'search' }, { text: '📊 Статистика', callback_data: 'stats' }]);
    await saveUsers(env, users);
    return send(env, chat, 'Пользователи:', { reply_markup: { inline_keyboard: rows } });
  }
  if (text.startsWith('/stats')) {
    const a = Object.values(users);
    return send(env, chat, 'Пользователей: ' + a.length + '\nАдминов: ' + a.filter(x => x.role === 'admin').length + '\nЗаблокировано: ' + a.filter(x => x.blocked).length);
  }
  if (text.startsWith('/find ')) {
    const q = norm(text.slice(6));
    const found = Object.values(users).filter(u => u.email.includes(q) || (u.name || '').toLowerCase().includes(q));
    if (!found.length) return send(env, chat, 'Ничего не найдено.');
    return send(env, chat, 'Найдено:', { reply_markup: { inline_keyboard: found.map(u => [{ text: u.email, callback_data: 'card:' + u.email }]) } });
  }
  if (text.startsWith('/add ')) {
    const parts = text.slice(5).trim().split(/\s+/);
    if (!/^\S+@\S+\.\S+$/.test(parts[0])) return send(env, chat, 'Некорректная почта.');
    const u = ensure(users, parts[0]); u.name = parts.slice(1).join(' '); await saveUsers(env, users);
    return send(env, chat, card(u), { reply_markup: kb(u) });
  }
  if (text.startsWith('/grant ')) { const u = ensure(users, text.slice(7)); u.role = 'admin'; await saveUsers(env, users); return send(env, chat, 'Админ выдан: ' + u.email); }
  if (text.startsWith('/revoke ')) { const u = ensure(users, text.slice(8)); u.role = 'user'; await saveUsers(env, users); return send(env, chat, 'Админ снят: ' + u.email); }
  return send(env, chat, 'Команды: /start /users /stats /find email /add email name /grant email /revoke email');
}
async function handleCallback(env, q) {
  const data = q.data || '', chat = q.message.chat.id, mid = q.message.message_id;
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  const users = await getUsers(env);
  if (data.startsWith('users:')) {
    const off = Number(data.split(':')[1]) || 0;
    const rows = Object.values(users).slice(off, off + 10).map(u => [{ text: (u.role === 'admin' ? '🛡 ' : '• ') + u.email, callback_data: 'card:' + u.email }]);
    if (off > 0) rows.push([{ text: '« Назад', callback_data: 'users:' + Math.max(0, off - 10) }]);
    if (off + 10 < Object.keys(users).length) rows.push([{ text: 'Вперёд »', callback_data: 'users:' + (off + 10) }]);
    return edit(env, chat, mid, 'Пользователи:', { reply_markup: { inline_keyboard: rows } });
  }
  if (data === 'stats') { const a = Object.values(users); return edit(env, chat, mid, 'Пользователей: ' + a.length + '\nАдминов: ' + a.filter(x => x.role === 'admin').length); }
  if (data === 'search') return send(env, chat, 'Отправьте почту или имя:');
  if (data.startsWith('card:')) { const u = users[norm(data.slice(5))]; return u ? edit(env, chat, mid, card(u), { reply_markup: kb(u) }) : send(env, chat, 'Не найден'); }
  if (data.startsWith('role:')) { const p = data.split(':'); const u = ensure(users, p[1]); u.role = p[2] === 'admin' ? 'admin' : 'user'; await saveUsers(env, users); return edit(env, chat, mid, card(u), { reply_markup: kb(u) }); }
  if (data.startsWith('block:')) { const p = data.split(':'); const u = ensure(users, p[1]); u.blocked = p[2] === '1'; await saveUsers(env, users); return edit(env, chat, mid, card(u), { reply_markup: kb(u) }); }
  if (data.startsWith('limit:')) { const p = data.split(':'); const u = ensure(users, p[1]); u.scans_limit = Number(p[2]) || 6; await saveUsers(env, users); return edit(env, chat, mid, card(u), { reply_markup: kb(u) }); }
  if (data.startsWith('del:')) { delete users[norm(data.slice(4))]; await saveUsers(env, users); return edit(env, chat, mid, 'Удалено'); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/setup') {
      const r = await tg(env, 'setWebhook', { url: url.origin + '/webhook', drop_pending_updates: true });
      return new Response(JSON.stringify(r), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    if (url.pathname === '/webhook') {
      const u = await request.json();
      try { if (u.message) await handleMessage(env, u.message); if (u.callback_query) await handleCallback(env, u.callback_query); } catch (e) { console.error(e); }
      return new Response('ok', { headers: cors });
    }
    if (url.pathname === '/api/users') {
      const users = await getUsers(env);
      return new Response(JSON.stringify(Object.values(users)), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    if (url.pathname === '/api/set') {
      const email = norm(url.searchParams.get('email')), field = url.searchParams.get('field'), value = url.searchParams.get('value');
      const users = await getUsers(env); const u = ensure(users, email);
      if (field === 'role') u.role = value === 'admin' ? 'admin' : 'user';
      if (field === 'blocked') u.blocked = value === '1';
      if (field === 'limit') u.scans_limit = Number(value) || 6;
      await saveUsers(env, users);
      return new Response(JSON.stringify(u), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    return new Response('HabitLife bot worker', { headers: cors });
  }
};