// ==UserScript==
// @name         Легион → Discord (статус «Играет в Legion»)
// @namespace    https://github.com/3odaPl/legion-discord-status
// @homepageURL  https://github.com/3odaPl/legion-discord-status
// @downloadURL  https://raw.githubusercontent.com/3odaPl/legion-discord-status/main/legion-discord.user.js
// @updateURL    https://raw.githubusercontent.com/3odaPl/legion-discord-status/main/legion-discord.user.js
// @version      1.4
// @description  Пока открыт сайт Легиона, сообщает программе legion_discord.py на этом компьютере, где ты в игре. В игре ничего не нажимает.
// @match        https://play.multidonate.ru/c/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      play.multidonate.ru
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  const URL_APP = 'http://127.0.0.1:47321/presence';   // порт — как PORT в legion_discord.py
  const EVERY = 15000;

  const $ = (s) => document.querySelector(s);
  const visible = (el) => !!el && !el.hidden && el.offsetParent !== null;
  const channel = (location.pathname.match(/^\/c\/([^/]+)/) || [])[1] || '';

  // раздел сайта — по активной вкладке (кнопка с aria-current="page" или открытая секция #tab-…)
  const TABS = {
    hero: 'Прокачивает героя', city: 'Гуляет по Городу', quest: 'В походе', legion: 'Смотрит рейтинг Легиона',
    news: 'Читает новости', world: 'Смотрит карту мира', streamer: 'В режиме стримера',
  };
  function tab() {
    const b = $('[data-tab][aria-current="page"]'); if (b && TABS[b.dataset.tab]) return b.dataset.tab;
    for (const k of Object.keys(TABS)) if (visible(document.getElementById('tab-' + k))) return k;
    return '';
  }
  // класс героя — смайлик и название (название берём из игры: стиль канала может звать классы по-своему)
  const CLASSES = {
    recruit: ['🔰', 'Новобранец'], legionary: ['🛡️', 'Легионер'], archer: ['🏹', 'Лучник'], mage: ['🔮', 'Маг'],
    priest: ['✨', 'Жрец'], rogue: ['🗡️', 'Разбойник'], necromancer: ['💀', 'Некромант'], paladin: ['⚜️', 'Паладин'],
  };
  const NAME2ID = {}; for (const [id, [, n]] of Object.entries(CLASSES)) NAME2ID[n.toLowerCase()] = id;
  const log = (...a) => console.log('%c[Легион → Discord]', 'color:#7c5cff;font-weight:bold', ...a);
  let hero = null, heroOk = 0, heroTry = 0;
  // запасной путь к сайту — через Tampermonkey (с теми же cookie, что и у страницы)
  const gmJson = (url) => new Promise((res) => {
    try {
      GM_xmlhttpRequest({ method: 'GET', url, timeout: 8000, onload: (r) => { try { res(JSON.parse(r.responseText)); } catch (e) { res(null); } }, onerror: () => res(null), ontimeout: () => res(null) });
    } catch (e) { res(null); }
  });
  async function loadHero() {
    const now = Date.now();
    if (now - heroOk < 5 * 60000 || now - heroTry < 30000) return;   // удалось — раз в 5 мин; не удалось — снова через 30 с
    heroTry = now;
    const url = location.origin + (channel ? `/c/${channel}` : '') + '/api/me';   // сайт сам добавляет /c/<канал> к своим запросам — мы тоже
    let r = null;
    try { r = await fetch(url, { credentials: 'same-origin' }).then((x) => x.json()); } catch (e) {}
    if (!r || !r.hero) r = await gmJson(url);
    if (r && r.hero) { hero = r.hero; heroOk = now; log('класс:', hero.ghost ? 'призрак' : hero.role, hero.roleName || ''); }
    else log('не удалось узнать класс с сайта — беру со страницы героя');
  }
  // со страницы: подпись класса в карточке героя (<span class="rl">Легионер</span>)
  function domHero() {
    for (const el of document.querySelectorAll('#tab-hero .rl, .rl')) {
      const t = (el.textContent || '').trim(); if (!t) continue;
      if (/призрак/i.test(t)) return { ghost: true };
      return { role: NAME2ID[t.toLowerCase()] || '', roleName: t };
    }
    return null;
  }
  function cls() {
    const h = hero || domHero();
    if (!h) return '';
    if (h.ghost) return '👻 Призрак';
    const c = CLASSES[h.role] || ['⚔️', ''];
    const name = h.roleName || c[1] || h.role || '';
    return (c[0] + ' ' + name).trim();
  }
  const join = (...a) => a.filter(Boolean).join(' · ') || null;

  function where() {
    const k = cls();
    if ($('.mn-view')) {
      const me = $('.mn-heroes [data-k="me"]');
      const floor = (($('[data-mn="floor"]') || {}).textContent || '').replace(/\s+/g, ' ').trim()
        .split('·').map((x) => x.trim()).filter((x) => x && !/рекорд/i.test(x)).join(' · ');   // «рекорд N» не показываем
      return { details: me && me.classList.contains('dig') ? 'Копает в шахте ⛏' : 'В шахте', state: join(k, floor).slice(0, 120) };
    }
    const t = tab();
    return { details: TABS[t] || 'Играет в Легион', state: join(k, channel) };
  }

  function send(data) {
    try {
      GM_xmlhttpRequest({ method: 'POST', url: URL_APP, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(data), timeout: 4000, onerror() {}, ontimeout() {} });
    } catch (e) { /* программа не запущена — ничего страшного */ }
  }

  loadHero().then(() => send(where()));
  setInterval(() => { loadHero(); send(where()); }, EVERY);
  window.addEventListener('pagehide', () => send({ closed: true }));
})();
