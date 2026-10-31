// ==UserScript==
// @name         Легион → Discord (статус «Играет в Legion»)
// @namespace    https://github.com/3odaPl/legion-discord-status
// @homepageURL  https://github.com/3odaPl/legion-discord-status
// @downloadURL  https://raw.githubusercontent.com/3odaPl/legion-discord-status/main/legion-discord.user.js
// @updateURL    https://raw.githubusercontent.com/3odaPl/legion-discord-status/main/legion-discord.user.js
// @version      1.3
// @description  Пока открыт сайт Легиона, сообщает программе legion_discord.py на этом компьютере, где ты в игре. В игре ничего не нажимает.
// @match        https://play.multidonate.ru/c/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
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
  let hero = null, heroAt = 0;
  async function loadHero() {
    if (Date.now() - heroAt < 5 * 60000) return;
    heroAt = Date.now();
    try { const r = await fetch((channel ? `/c/${channel}` : '') + '/api/me', { credentials: 'same-origin' }).then((x) => x.json()); if (r && r.hero) hero = r.hero; } catch (e) {}
  }
  function cls() {
    if (!hero) return '';
    if (hero.ghost) return '👻 Призрак';
    const c = CLASSES[hero.role] || ['⚔️', ''];
    const name = hero.roleName || c[1] || hero.role || '';
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
