// ==UserScript==
// @name         南+ 阅读助手 Lite
// @namespace    southplus-reader-lite
// @version      1.0.0
// @description  只为舒服看帖：帖内直出图片(含 imgbox/ibb/postimg/pixhost/imgur 等图床)、网盘链接卡片+提取码、0SP 内容免刷新自动购买(绝不买收费)、已读记忆+新回复提示、更顺手的搜索、清爽排版。
// @author       lite
// @license      MIT
// @match        *://*.south-plus.net/*
// @match        *://south-plus.net/*
// @match        *://*.south-plus.org/*
// @match        *://south-plus.org/*
// @match        *://*.north-plus.net/*
// @match        *://north-plus.net/*
// @match        *://*.east-plus.net/*
// @match        *://east-plus.net/*
// @match        *://*.white-plus.net/*
// @match        *://white-plus.net/*
// @match        *://*.level-plus.net/*
// @match        *://level-plus.net/*
// @match        *://*.soul-plus.net/*
// @match        *://soul-plus.net/*
// @match        *://*.snow-plus.net/*
// @match        *://snow-plus.net/*
// @match        *://*.spring-plus.net/*
// @match        *://spring-plus.net/*
// @match        *://*.summer-plus.net/*
// @match        *://summer-plus.net/*
// @match        *://*.blue-plus.net/*
// @match        *://blue-plus.net/*
// @match        *://*.imoutolove.me/*
// @match        *://imoutolove.me/*
// @exclude      *://*/simple/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      *
// ==/UserScript==

/*
 * 结构一览（按顺序读即可）：
 *   0. 设置项            —— 所有可开关的东西都在 DEFAULTS 里
 *   1. 小工具            —— DOM / 存储 / 请求
 *   2. 样式
 *   3. 已读记忆 + 新回复提示
 *   4. 列表页：本页筛选 / 键盘翻页
 *   5. 帖子页：图片直出 / 图床解析 / 网盘卡片 / Gofile / 灯箱 / 排版
 *   6. 帖子页：0SP 免刷新自动购买
 *   7. 搜索增强
 *   8. 悬浮工具条 + 设置面板
 *   9. 启动
 */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
   * 0. 设置项
   * ══════════════════════════════════════════ */
  const NS = 'spl:';
  const DEFAULTS = {
    autoBuyFree:   true,        // 自动购买 0SP 内容（免刷新）。永远不买 >0SP
    inlineMedia:   true,        // 帖内文字链接 → 直接显示图片 / 视频
    resolveHosts:  true,        // 解析图床页面链接（imgbox / ibb / postimg / pixhost / imgur …）
    gofile:        true,        // 解析 Gofile 文件夹，显示缩略图
    panCards:      true,        // 网盘链接变成卡片 + 自动识别提取码
    markVisited:   true,        // 已读记忆 + 新回复 +N 提示
    cleanLayout:   true,        // 清爽排版（字号、行高、图片、引用折叠）
    wideMode:      true,        // 内容区加宽
    contentWidth:  1200,        // 加宽到多少 px
    fontSize:      16,          // 正文字号
    hideAvatars:   false,       // 隐藏楼层左侧头像资料
    floatingSearch:true,        // 右下角悬浮搜索
    searchTime:    '31536000',  // 搜索默认时间范围（秒）：一年
    maxResolves:   80,          // 每页最多解析多少个图床链接
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch { /* 空间满了就算了 */ } },
    del(k) { localStorage.removeItem(NS + k); },
  };
  const cfg = Object.assign({}, DEFAULTS, store.get('config', {}));

  /* ══════════════════════════════════════════
   * 1. 小工具
   * ══════════════════════════════════════════ */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getTid = url => (String(url || '').match(/tid[-=](\d+)/) || [])[1];
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function el(tag, attrs = {}, html) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    if (html != null) e.innerHTML = html;
    return e;
  }

  const PATH = location.pathname;
  const PAGE =
    /\/read\.php$/.test(PATH) ? 'read' :
    /\/(thread|thread_new)\.php$/.test(PATH) ? 'list' :
    /\/search\.php$/.test(PATH) ? 'search' :
    /\/(index\.php)?$/.test(PATH) ? 'index' : 'other';

  // 站内请求：带 cookie、按页面编码解码、遵守“刷新不要快于 1 秒”
  let lastSiteReq = 0, reqChain = Promise.resolve();
  function siteFetch(url, opt = {}) {
    const p = reqChain.then(async () => {
      const wait = 1100 - (Date.now() - lastSiteReq);
      if (wait > 0) await sleep(wait);
      lastSiteReq = Date.now();
      const res = await fetch(url, { credentials: 'same-origin', ...opt });
      const buf = await res.arrayBuffer();
      return new TextDecoder(document.characterSet || 'utf-8').decode(buf);
    });
    reqChain = p.catch(() => {});   // 串行排队，保证任何时候都不会两个请求挤在 1 秒内
    return p;
  }
  const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');

  // 跨域请求（图床 / gofile）
  function gmFetch(url, opt = {}) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        fetch(url, opt).then(r => r.text()).then(resolve, reject);
        return;
      }
      GM_xmlhttpRequest({
        method: opt.method || 'GET', url, headers: opt.headers || {}, data: opt.body, timeout: 15000,
        onload: r => (r.status >= 200 && r.status < 400) ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status)),
        onerror: () => reject(new Error('network')),
        ontimeout: () => reject(new Error('timeout')),
      });
    });
  }

  // 简单并发队列
  function makeQueue(limit) {
    let active = 0; const waiting = [];
    const next = () => { if (active >= limit || !waiting.length) return; active++; const job = waiting.shift(); job().finally(() => { active--; next(); }); };
    return fn => new Promise((res, rej) => { waiting.push(() => fn().then(res, rej)); next(); });
  }

  function toast(msg, ms = 2500) {
    let box = $('#spl-toast');
    if (!box) { box = el('div', { id: 'spl-toast' }); document.body.appendChild(box); }
    const item = el('div', { class: 'spl-toast-item' }, esc(msg));
    box.appendChild(item);
    setTimeout(() => item.remove(), ms);
  }

  /* ══════════════════════════════════════════
   * 2. 样式
   * ══════════════════════════════════════════ */
  const CSS = `
:root { --spl-fs: ${cfg.fontSize}px; --spl-w: ${cfg.contentWidth}px; }

/* 已读 / 新回复 */
a.spl-visited { color: #9a9a9a !important; }
.spl-new { display:inline-block; margin-left:6px; padding:0 7px; font-size:11px; line-height:17px; border-radius:9px;
  background:#ff5a5a; color:#fff !important; text-decoration:none !important; font-weight:bold; vertical-align:middle; }
.spl-new:hover { background:#e03c3c; }
.spl-read-tag { display:inline-block; margin-left:6px; font-size:11px; color:#bbb; vertical-align:middle; }

/* 本页筛选 */
.spl-filter { display:flex; gap:8px; align-items:center; margin:6px 0; font-size:13px; }
.spl-filter input { flex:1; max-width:420px; padding:5px 10px; border:1px solid #cfd8dc; border-radius:16px; outline:none; font-size:13px; }
.spl-filter input:focus { border-color:#4a90e2; box-shadow:0 0 0 2px rgba(74,144,226,.15); }
.spl-filter .spl-count { color:#888; }
tr.spl-hide { display:none !important; }

/* 清爽排版 */
html.spl-wide #main, html.spl-wide .main, html.spl-wide .crumbs { width:auto !important; max-width:var(--spl-w) !important; margin-left:auto !important; margin-right:auto !important; }
html.spl-clean .tpc_content { font-size:var(--spl-fs) !important; line-height:1.85 !important; word-break:break-word; overflow-wrap:anywhere; }
html.spl-clean .tpc_content img:not(.spl-emoji) { max-width:100% !important; width:auto !important; height:auto !important; display:block; margin:10px auto;
  border-radius:6px; cursor:zoom-in; box-shadow:0 1px 5px rgba(0,0,0,.12); }
html.spl-clean .tpc_content img.spl-emoji { display:inline; vertical-align:middle; margin:0 1px; }
html.spl-clean .tpc_content video { display:block; max-width:100%; margin:10px auto; border-radius:6px; background:#000; }
html.spl-clean .tpc_content .quote, html.spl-clean .tpc_content blockquote { position:relative; }
html.spl-noavatar .user-pic, html.spl-noavatar .user-info, html.spl-noavatar th.r_one dl { display:none !important; }
html.spl-noavatar th.r_one { width:110px !important; }
.spl-fold { max-height:220px; overflow:hidden; }
.spl-fold-btn { display:block; text-align:center; font-size:12px; color:#4a90e2; cursor:pointer; padding:4px; background:linear-gradient(transparent, #fff 60%); margin-top:-30px; position:relative; }

/* 媒体 */
.spl-media { display:block; margin:10px auto; text-align:center; }
.spl-media img { max-width:100% !important; height:auto !important; display:block; margin:0 auto; border-radius:6px; cursor:zoom-in; box-shadow:0 1px 5px rgba(0,0,0,.12); }
.spl-media .spl-cap { font-size:11px; color:#999; margin-top:2px; }
.spl-media .spl-cap a { color:#999; }
.spl-loading { display:inline-block; font-size:12px; color:#999; padding:2px 8px; border:1px dashed #ccc; border-radius:4px; margin:2px 0; }
.spl-failed { color:#c66; border-color:#e9b8b8; }
.spl-link { color:#1a6fd6; text-decoration:underline dotted; }

/* 网盘卡片 */
.spl-pan { display:inline-flex; align-items:center; gap:0; margin:3px 4px 3px 0; border:1px solid #dfe5ea; border-radius:6px; background:#fafbfc; font-size:13px; line-height:1; overflow:hidden; vertical-align:middle; max-width:100%; }
.spl-pan > a { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; color:#333 !important; text-decoration:none !important; min-width:0; }
.spl-pan > a:hover { background:#eef3f8; }
.spl-pan b { color:#fff; font-size:11px; padding:3px 6px; border-radius:4px; white-space:nowrap; font-weight:600; }
.spl-pan .spl-url { color:#555; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:380px; }
.spl-pan .spl-code { display:inline-flex; align-items:center; gap:6px; padding:0 8px; border-left:1px solid #dfe5ea; height:100%; align-self:stretch; color:#666; font-size:12px; }
.spl-pan .spl-code code { font-weight:bold; color:#d0453a; font-size:13px; letter-spacing:1px; }
.spl-pan button { border:0; background:#e8eef4; color:#345; font-size:11px; padding:3px 7px; border-radius:4px; cursor:pointer; }
.spl-pan button:hover { background:#d5e2ee; }

/* Gofile */
.spl-gofile { display:block; margin:8px 0; border:1px solid #dfe5ea; border-radius:8px; padding:8px 10px; background:#fafbfc; }
.spl-gofile .spl-gf-head { font-size:13px; color:#333; display:flex; align-items:center; gap:8px; }
.spl-gofile .spl-gf-head b { background:#1abc9c; color:#fff; font-size:11px; padding:3px 6px; border-radius:4px; }
.spl-gofile .spl-gf-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:8px; margin-top:8px; }
.spl-gofile .spl-gf-item { font-size:11px; color:#555; text-align:center; overflow:hidden; }
.spl-gofile .spl-gf-item img { width:100%; height:110px; object-fit:cover; border-radius:5px; display:block; margin:0 0 3px; box-shadow:none; cursor:pointer; }
.spl-gofile .spl-gf-item .spl-gf-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* 购买状态 */
.spl-buy { display:block; margin:6px 0; padding:6px 10px; border-radius:6px; font-size:13px; }
.spl-buy-doing { background:#fff7e0; color:#8a6300; }
.spl-buy-ok { background:#e8f7ec; color:#1d7a3a; }
.spl-buy-skip { background:#f3f3f3; color:#666; }
.spl-buy-err { background:#fdecec; color:#a33; }

/* 灯箱 */
#spl-lb { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.92); display:flex; align-items:center; justify-content:center; user-select:none; }
#spl-lb img { max-width:96vw; max-height:96vh; object-fit:contain; box-shadow:0 0 30px rgba(0,0,0,.6); }
#spl-lb .spl-lb-nav { position:absolute; top:0; bottom:0; width:18%; cursor:pointer; opacity:0; transition:opacity .15s; display:flex; align-items:center; justify-content:center; color:#fff; font-size:40px; }
#spl-lb .spl-lb-nav:hover { opacity:.7; }
#spl-lb .spl-lb-prev { left:0; } #spl-lb .spl-lb-next { right:0; }
#spl-lb .spl-lb-info { position:absolute; top:10px; left:50%; transform:translateX(-50%); color:#ddd; font-size:13px; background:rgba(0,0,0,.4); padding:3px 10px; border-radius:10px; }
#spl-lb .spl-lb-close { position:absolute; top:8px; right:14px; color:#fff; font-size:28px; cursor:pointer; opacity:.7; }

/* 悬浮工具条 */
#spl-bar { position:fixed; right:14px; bottom:60px; z-index:9999; display:flex; flex-direction:column; gap:6px; }
#spl-bar button { width:36px; height:36px; border-radius:50%; border:0; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.18); cursor:pointer; font-size:16px; opacity:.75; }
#spl-bar button:hover { opacity:1; }
#spl-search { position:fixed; right:60px; bottom:60px; z-index:9999; background:#fff; border-radius:10px; box-shadow:0 4px 18px rgba(0,0,0,.2); padding:10px; width:320px; display:none; }
#spl-search.open { display:block; }
#spl-search input { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #ccd; border-radius:6px; font-size:14px; outline:none; }
#spl-search .spl-recent { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
#spl-search .spl-recent span { font-size:12px; background:#eef2f6; padding:2px 8px; border-radius:10px; cursor:pointer; color:#345; }
#spl-search .spl-recent span:hover { background:#dbe5ef; }
#spl-search .spl-tip { font-size:11px; color:#999; margin-top:6px; }
mark.spl-hl { background:#fff3a0; color:inherit; padding:0 1px; }

/* 设置面板 */
#spl-mask { position:fixed; inset:0; z-index:99998; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; }
#spl-panel { background:#fff; width:440px; max-height:86vh; overflow:auto; border-radius:12px; padding:18px 20px; font-size:14px; box-shadow:0 10px 40px rgba(0,0,0,.3); }
#spl-panel h3 { margin:0 0 12px; font-size:16px; }
#spl-panel label { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid #f0f0f0; gap:12px; }
#spl-panel label small { display:block; color:#999; font-size:11px; }
#spl-panel input[type=number] { width:80px; padding:3px 6px; }
#spl-panel .spl-actions { display:flex; gap:8px; margin-top:14px; justify-content:flex-end; }
#spl-panel .spl-actions button { padding:6px 14px; border-radius:6px; border:1px solid #ccc; background:#fff; cursor:pointer; }
#spl-panel .spl-actions .spl-primary { background:#2f7bea; color:#fff; border-color:#2f7bea; }

/* toast */
#spl-toast { position:fixed; left:50%; top:16px; transform:translateX(-50%); z-index:100000; display:flex; flex-direction:column; gap:6px; }
.spl-toast-item { background:rgba(30,30,30,.9); color:#fff; padding:8px 16px; border-radius:8px; font-size:13px; }
`;
  document.head.appendChild(el('style', {}, CSS));
  if (cfg.cleanLayout) document.documentElement.classList.add('spl-clean');
  if (cfg.wideMode) document.documentElement.classList.add('spl-wide');
  if (cfg.hideAvatars) document.documentElement.classList.add('spl-noavatar');

  /* ══════════════════════════════════════════
   * 3. 已读记忆 + 新回复提示
   *    visited[tid] = { t: 标题, r: 上次看到的回复数, ts: 时间, p: 上次看的页 }
   * ══════════════════════════════════════════ */
  const visited = store.get('visited', {});
  const saveVisited = debounce(() => {
    const keys = Object.keys(visited);
    if (keys.length > 4000) {                       // 只留最近 4000 条
      keys.sort((a, b) => (visited[a].ts || 0) - (visited[b].ts || 0)).slice(0, keys.length - 4000).forEach(k => delete visited[k]);
    }
    store.set('visited', visited);
  }, 300);

  function remember(tid, patch) {
    if (!tid) return;
    visited[tid] = Object.assign(visited[tid] || {}, patch, { ts: Date.now() });
    saveVisited();
  }

  // 判断是不是列表里的“标题链接”（排除页码、最后回复等链接）
  function isTitleLink(a) {
    if (!/read\.php\?tid[-=]\d+/.test(a.getAttribute('href') || '')) return false;
    if (/page-e|#a$|#\d+$/.test(a.getAttribute('href'))) return false;
    if (a.closest('.tpage, .pages, .spl-new')) return false;
    if (a.querySelector('img')) return false;
    const t = a.textContent.trim();
    return t.length > 1 && !/^\d+$/.test(t);
  }

  // 从这一行里找“回复数”：标题格右侧第一个纯数字格（或 “12 / 3456” 格式）
  function rowReplies(row, titleCell) {
    if (!row || !titleCell) return null;
    const cells = Array.from(row.cells);
    const idx = cells.indexOf(titleCell);
    for (const td of cells.slice(idx + 1)) {
      const m = td.textContent.trim().match(/^(\d+)(?:\s*\/\s*\d+)?$/);
      if (m) return +m[1];
    }
    return null;
  }

  function markVisitedLinks(root = document) {
    if (!cfg.markVisited) return;
    $$('a[href*="read.php?tid"]', root).forEach(a => {
      if (a.dataset.splSeen || !isTitleLink(a)) return;
      a.dataset.splSeen = '1';
      const tid = getTid(a.getAttribute('href'));
      const row = a.closest('tr');
      const cell = a.closest('td');
      const replies = rowReplies(row, cell);
      const title = a.textContent.trim();

      // 点标题（含中键 / Ctrl 点）就记住：标题 + 当前回复数
      const onOpen = () => remember(tid, { t: title, r: replies != null ? replies : (visited[tid] || {}).r });
      a.addEventListener('click', onOpen, true);
      a.addEventListener('auxclick', onOpen, true);

      const rec = visited[tid];
      if (!rec) return;
      a.classList.add('spl-visited');
      if (replies != null && rec.r != null && replies > rec.r) {
        const badge = el('a', {
          class: 'spl-new', href: `read.php?tid-${tid}-page-e.html`, title: `上次看到 ${rec.r} 楼回复，现在 ${replies}`,
        }, `+${replies - rec.r} 新`);
        badge.addEventListener('click', () => remember(tid, { r: replies }), true);
        badge.addEventListener('auxclick', () => remember(tid, { r: replies }), true);
        a.after(badge);
      } else if (replies != null && rec.r == null) {
        rec.r = replies; saveVisited();      // 直接进过的帖子，第一次在列表看到时补上基准
      }
    });
  }

  function rememberCurrentThread() {
    const tid = getTid(location.href);
    if (!tid) return;
    const crumb = $('.crumbs-item.current, .crumbs strong');
    const title = (crumb ? crumb.textContent : document.title.split(/\s*[|\-–]\s*/)[0]).trim();
    const page = +(location.search.match(/page[-=](\d+)/) || [])[1] || 1;
    remember(tid, { t: title || (visited[tid] || {}).t, p: page });
  }

  /* ══════════════════════════════════════════
   * 4. 列表页：本页筛选 / 键盘翻页
   * ══════════════════════════════════════════ */
  function initListFilter() {
    // 优先 #ajaxtable；否则找“自己含 ≥5 个标题链接、且里面没有更小的这种表格”的最内层表格
    const many = t => $$('a', t).filter(isTitleLink).length >= 5;
    const table = $('#ajaxtable') || $$('table').find(t => many(t) && !$$('table', t).some(many));
    if (!table) return;
    const bar = el('div', { class: 'spl-filter' },
      `<input placeholder="筛选本页：关键词 空格 多个词 / -排除词 / @作者  （Esc 清空）">
       <span class="spl-count"></span>`);
    table.parentNode.insertBefore(bar, table);
    const input = $('input', bar), count = $('.spl-count', bar);
    const rows = () => $$('tr', table).filter(tr => $$('a', tr).some(isTitleLink));

    const apply = () => {
      const tokens = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0, total = 0;
      rows().forEach(tr => {
        total++;
        const title = ($$('a', tr).find(isTitleLink) || {}).textContent || '';
        const author = ($('a[href*="u.php"]', tr) || {}).textContent || '';
        const text = (title + ' ' + tr.textContent).toLowerCase();
        const ok = tokens.every(tk =>
          tk.startsWith('-') ? !text.includes(tk.slice(1)) :
          tk.startsWith('@') ? author.toLowerCase().includes(tk.slice(1)) :
          text.includes(tk));
        tr.classList.toggle('spl-hide', !ok);
        if (ok) shown++;
      });
      count.textContent = tokens.length ? `${shown} / ${total}` : '';
    };
    input.addEventListener('input', apply);
    input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = ''; apply(); } });
  }

  function initKeyPaging() {
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select, [contenteditable]') || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const pages = $('.pages'); if (!pages) return;
      const cur = $('b', pages); if (!cur) return;
      const target = e.key === 'ArrowRight'
        ? cur.nextElementSibling && cur.nextElementSibling.matches('a[href]') && cur.nextElementSibling
        : cur.previousElementSibling && cur.previousElementSibling.matches('a[href]') && cur.previousElementSibling;
      if (target) location.href = target.href;
    });
  }

  /* ══════════════════════════════════════════
   * 5. 帖子页：媒体直出
   * ══════════════════════════════════════════ */
  const IMG_EXT = /\.(?:jpe?g|png|gif|webp|bmp|avif)(?:[?#][^\s]*)?$/i;
  const VID_EXT = /\.(?:mp4|webm|mov|m4v)(?:[?#][^\s]*)?$/i;
  const URL_RE  = /(?:https?:\/\/|magnet:\?)[^\s<>"'`，。；！？、（）【】《》「」]+/g;
  const URL_TEST = new RegExp(URL_RE.source, 'i');   // 不带 g，专门用来 test（带 g 的 test 会记 lastIndex 出错）
  const EMOJI_RE = /\/(?:post\/smile|smile|face|faces|kaoani|emot)\/|\/images\/face|\/(?:face\d+|fly_\d+)\.(?:gif|png)$/i;

  // 缩略图 → 原图（纯 URL 改写，不用请求）
  const THUMB_RULES = [
    [/^https?:\/\/thumbs(\d*)\.imgbox\.com\/(.+)_t\.(\w+)$/i, 'https://images$1.imgbox.com/$2_o.$3'],
    [/^https?:\/\/t(\d+)\.pixhost\.to\/thumbs\/(.+)$/i,       'https://img$1.pixhost.to/images/$2'],
    [/^https?:\/\/i\.imgur\.com\/(\w{7})[sbtmlh]\.(\w+)$/i,   'https://i.imgur.com/$1.$2'],
  ];
  // 需要打开页面取 og:image 的图床
  const HOST_PAGE_RE = /^https?:\/\/(?:www\.)?(?:imgbox\.com\/[A-Za-z0-9]+|ibb\.co\/\w+|postimg\.cc\/\w+|pixhost\.to\/show\/|imgur\.com\/(?!a\/|gallery\/)\w+$|imagebam\.com\/(?:view|image)\/|imagevenue\.com\/\w+|lensdump\.com\/i\/|imgbb\.com\/\w+|freeimage\.host\/i\/|iili\.io\/\w+$|jpg\d?\.\w+\/img\/|imgpile\.com\/i\/|imagetwist\.com\/\w+|imx\.to\/i\/|pixl\.li\/image\/|catbox\.moe\/\w+$)/i;

  const PAN_HOSTS = [
    ['百度网盘', /pan\.baidu\.com\/(?:s|share)\//i, '#2b6df6'],
    ['夸克网盘', /pan\.quark\.cn\/s\//i, '#6c4cf1'],
    ['阿里云盘', /(?:alipan|aliyundrive)\.com\/s\//i, '#637dff'],
    ['123云盘', /123\w*\.com\/s\//i, '#00a884'],
    ['天翼云盘', /cloud\.189\.cn\//i, '#e74c3c'],
    ['蓝奏云',  /lanzou?\w*\.com\//i, '#f39c12'],
    ['迅雷云盘', /pan\.xunlei\.com\/s\//i, '#1e90ff'],
    ['115网盘', /115\.com\/s\//i, '#e67e22'],
    ['UC网盘',  /drive\.uc\.cn\/s\//i, '#ff7a00'],
    ['MEGA',    /mega\.nz\//i, '#d9272e'],
    ['MediaFire', /mediafire\.com\//i, '#1299f3'],
    ['Pixeldrain', /pixeldrain\.com\/[ul]\//i, '#607d8b'],
    ['Google Drive', /drive\.google\.com\//i, '#34a853'],
    ['OneDrive', /1drv\.ms\/|onedrive\.live\.com/i, '#0078d4'],
    ['TeraBox', /terabox\.com\/s\//i, '#0b5cff'],
    ['Bunkr',   /bunkr+\.\w+\//i, '#9b59b6'],
    ['Cyberdrop', /cyberdrop\.\w+\//i, '#8e44ad'],
    ['磁力',    /^magnet:/i, '#444'],
  ];

  const resolveQueue = makeQueue(3);
  const hostCache = store.get('hostcache', {});   // 页面链接 → 原图 URL（7 天）
  let resolvedCount = 0;

  // 把纯文字 URL 变成 <a>
  function linkify(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (!n.parentElement.closest('a, script, style, textarea, code, .spl-pan, .spl-gofile') && URL_TEST.test(n.nodeValue))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      let last = 0; const text = n.nodeValue;
      text.replace(URL_RE, (url, i) => {
        frag.appendChild(document.createTextNode(text.slice(last, i)));
        frag.appendChild(el('a', { href: url, class: 'spl-link', target: '_blank', rel: 'noreferrer' }, esc(url)));
        last = i + url.length;
      });
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.replaceWith(frag);
    });
  }

  function makeFigure(src, pageUrl) {
    const fig = el('span', { class: 'spl-media' });
    const img = el('img', { src, referrerpolicy: 'no-referrer', loading: 'lazy' });
    img.addEventListener('error', () => { fig.replaceWith(el('a', { href: pageUrl || src, target: '_blank', class: 'spl-loading spl-failed' }, '图片加载失败 · ' + esc(pageUrl || src))); }, { once: true });
    fig.appendChild(img);
    if (pageUrl) fig.appendChild(el('div', { class: 'spl-cap' }, `<a href="${esc(pageUrl)}" target="_blank" rel="noreferrer">${esc(pageUrl.replace(/^https?:\/\//, ''))}</a>`));
    return fig;
  }

  async function resolveHostPage(url) {
    const c = hostCache[url];
    if (c && Date.now() - c.ts < 7 * 864e5) return c.src;
    const html = await gmFetch(url);
    const pick = re => (html.match(re) || [])[1];
    let src = pick(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i)
      || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i)
      || pick(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)/i)
      || pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)
      || pick(/(https?:\/\/images\d*\.imgbox\.com\/[^"'\s]+_o\.\w+)/i);
    if (!src) throw new Error('no image');
    src = src.replace(/&amp;/g, '&');
    hostCache[url] = { src, ts: Date.now() };
    const keys = Object.keys(hostCache); if (keys.length > 600) keys.slice(0, 200).forEach(k => delete hostCache[k]);
    store.set('hostcache', hostCache);
    return src;
  }

  function passcodeNear(a, url) {
    const m1 = url.match(/[?&](?:pwd|password|code|passcode)=([A-Za-z0-9]{4,8})/i);
    if (m1) return m1[1];
    // 链接后面 80 个字符内找“提取码: xxxx”
    let text = '', n = a.nextSibling, budget = 80;
    while (n && budget > 0) { const t = n.textContent || ''; text += t; budget -= t.length; n = n.nextSibling; }
    if (!text.trim() && a.parentElement) text = a.parentElement.textContent.split(a.textContent).pop() || '';
    const m2 = text.match(/(?:提取码|密码|访问码|口令|pwd|code)\s*[:：=]?\s*([A-Za-z0-9]{4,8})/i);
    return m2 ? m2[1] : null;
  }

  function makePanCard(a, name, color, url) {
    const code = passcodeNear(a, url);
    const card = el('span', { class: 'spl-pan' });
    card.appendChild(el('a', { href: url, target: '_blank', rel: 'noreferrer' },
      `<b style="background:${color}">${name}</b><span class="spl-url">${esc(url.replace(/^https?:\/\/(www\.)?/, ''))}</span>`));
    if (code) {
      const box = el('span', { class: 'spl-code' }, `提取码 <code>${esc(code)}</code>`);
      box.appendChild(el('button', { onclick: e => { e.preventDefault(); navigator.clipboard.writeText(code).then(() => toast('已复制提取码 ' + code)); } }, '复制'));
      card.appendChild(box);
    }
    return card;
  }

  // ── Gofile ──
  async function gofileToken() {
    let t = store.get('gofile_token');
    if (t) return t;
    const r = JSON.parse(await gmFetch('https://api.gofile.io/accounts', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }));
    t = r && r.data && r.data.token; if (!t) throw new Error('gofile token');
    store.set('gofile_token', t); return t;
  }
  async function gofileList(id, retry = true) {
    const token = await gofileToken();
    const r = JSON.parse(await gmFetch(`https://api.gofile.io/contents/${id}?wt=4fd6sg89d7s6&cache=true`, { headers: { Authorization: 'Bearer ' + token } }));
    if (r.status !== 'ok') {
      if (retry) { store.del('gofile_token'); return gofileList(id, false); }
      throw new Error(r.status || 'gofile error');
    }
    return Object.values(r.data.children || {}).filter(f => f.type === 'file');
  }
  function fmtSize(n) { return n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB'; }
  function makeGofileCard(url) {
    const id = (url.match(/gofile\.io\/d\/([\w-]+)/) || [])[1];
    const card = el('span', { class: 'spl-gofile' },
      `<div class="spl-gf-head"><b>Gofile</b><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a><span class="spl-loading">读取中…</span></div>`);
    gofileList(id).then(files => {
      const st = $('.spl-loading', card);
      st.textContent = `${files.length} 个文件`; st.classList.remove('spl-loading');
      const grid = el('div', { class: 'spl-gf-grid' });
      files.slice(0, 60).forEach(f => {
        const item = el('a', { class: 'spl-gf-item', href: url, target: '_blank', rel: 'noreferrer', title: f.name });
        if (f.thumbnail) {
          const img = el('img', { src: f.thumbnail, referrerpolicy: 'no-referrer', loading: 'lazy' });
          img.addEventListener('error', () => img.remove(), { once: true });
          item.appendChild(img);
        }
        item.appendChild(el('div', { class: 'spl-gf-name' }, `${esc(f.name)} <span style="color:#aaa">${fmtSize(f.size || 0)}</span>`));
        grid.appendChild(item);
      });
      card.appendChild(grid);
    }).catch(e => {
      const st = $('.spl-loading', card);
      st.textContent = '无法读取（可能有密码/已删除）'; st.classList.add('spl-failed');
    });
    return card;
  }

  // ── 主入口：处理一个 .tpc_content ──
  function enhanceContent(content) {
    if (content.dataset.splDone) return;
    content.dataset.splDone = '1';

    // a) 站内原生图片：标记表情、去掉站点的 onclick 弹窗、处理懒加载属性
    $$('img', content).forEach(img => {
      const real = img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('data-org-img') || img.getAttribute('file');
      if (real && !/^data:/.test(real) && real !== img.getAttribute('src')) img.src = real;
      if (EMOJI_RE.test(img.getAttribute('src') || '')) { img.classList.add('spl-emoji'); return; }
      img.removeAttribute('onclick'); img.removeAttribute('onload'); img.removeAttribute('width'); img.removeAttribute('height');
      // 防盗链失败时，用 no-referrer 再试一次
      img.addEventListener('error', () => { if (!img.dataset.splRetry) { img.dataset.splRetry = '1'; img.referrerPolicy = 'no-referrer'; img.src = img.src; } }, { once: true });
    });

    if (!cfg.inlineMedia) return;

    linkify(content);

    $$('a[href]', content).forEach(a => {
      if (a.dataset.splMedia) return;
      a.dataset.splMedia = '1';
      const url = a.getAttribute('href') || '';
      if (!/^(https?:|magnet:)/i.test(url)) return;
      const inner = a.querySelector('img');

      // 缩略图 → 原图
      if (inner && !inner.classList.contains('spl-emoji')) {
        for (const [re, rep] of THUMB_RULES) {
          if (re.test(inner.src)) { inner.dataset.splFull = inner.src.replace(re, rep); break; }
        }
        if (!inner.dataset.splFull && IMG_EXT.test(url)) inner.dataset.splFull = url;
        if (!inner.dataset.splFull && cfg.resolveHosts && HOST_PAGE_RE.test(url) && resolvedCount < cfg.maxResolves) {
          resolvedCount++;
          resolveQueue(() => resolveHostPage(url)).then(src => { inner.dataset.splFull = src; }).catch(() => {});
        }
        // 点缩略图不跳走，而是进灯箱看大图（灯箱会用 splFull）
        a.addEventListener('click', e => { if (inner.dataset.splFull) { e.preventDefault(); openLightbox(inner); } });
        return;
      }

      // Gofile 文件夹
      if (cfg.gofile && /gofile\.io\/d\//i.test(url)) { a.replaceWith(makeGofileCard(url)); return; }

      // 网盘 → 卡片
      if (cfg.panCards) {
        const hit = PAN_HOSTS.find(([, re]) => re.test(url));
        if (hit) { a.replaceWith(makePanCard(a, hit[0], hit[2], url)); return; }
      }

      // 直链图片 / 视频
      if (IMG_EXT.test(url)) { a.replaceWith(makeFigure(url)); return; }
      if (VID_EXT.test(url)) {
        const v = el('video', { controls: '', preload: 'metadata', src: url });
        a.replaceWith(v); return;
      }

      // 图床页面 → 抓 og:image
      if (cfg.resolveHosts && HOST_PAGE_RE.test(url) && resolvedCount < cfg.maxResolves) {
        resolvedCount++;
        const ph = el('span', { class: 'spl-loading' }, '解析图片 · ' + esc(url.replace(/^https?:\/\//, '')));
        a.replaceWith(ph);
        resolveQueue(() => resolveHostPage(url))
          .then(src => ph.replaceWith(makeFigure(src, url)))
          .catch(() => { ph.className = 'spl-loading spl-failed'; ph.innerHTML = `解析失败 · <a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a>`; });
      }
    });

    // b) 排版：折叠超长引用、压缩连续空行
    if (cfg.cleanLayout) {
      $$('.quote, blockquote', content).forEach(q => {
        if (q.offsetHeight > 320 && !q.dataset.splFold) {
          q.dataset.splFold = '1'; q.classList.add('spl-fold');
          const btn = el('span', { class: 'spl-fold-btn' }, '▼ 展开引用');
          btn.addEventListener('click', () => { q.classList.toggle('spl-fold'); btn.textContent = q.classList.contains('spl-fold') ? '▼ 展开引用' : '▲ 收起引用'; });
          q.after(btn);
        }
      });
      $$('br + br + br', content).forEach(br => br.remove());
    }
  }

  // ── 灯箱 ──
  function galleryImages() {
    return $$('.tpc_content img:not(.spl-emoji)').filter(i => !i.closest('.spl-gofile') && (!i.complete || i.naturalWidth > 120));
  }
  function openLightbox(startImg) {
    const imgs = galleryImages();
    let idx = Math.max(0, imgs.indexOf(startImg));
    const lb = el('div', { id: 'spl-lb' },
      `<div class="spl-lb-nav spl-lb-prev">‹</div><img><div class="spl-lb-nav spl-lb-next">›</div>
       <div class="spl-lb-info"></div><div class="spl-lb-close">×</div>`);
    const big = $('img', lb), info = $('.spl-lb-info', lb);
    const show = () => { const i = imgs[idx]; big.src = i.dataset.splFull || i.src; info.textContent = `${idx + 1} / ${imgs.length}`; };
    const move = d => { idx = (idx + d + imgs.length) % imgs.length; show(); };
    const close = () => { lb.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'ArrowRight') move(1); };
    $('.spl-lb-prev', lb).onclick = e => { e.stopPropagation(); move(-1); };
    $('.spl-lb-next', lb).onclick = e => { e.stopPropagation(); move(1); };
    lb.addEventListener('click', e => { if (e.target === lb || e.target === big || e.target.classList.contains('spl-lb-close')) close(); });
    lb.addEventListener('wheel', e => { e.preventDefault(); move(e.deltaY > 0 ? 1 : -1); }, { passive: false });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(lb); show();
  }
  // 捕获阶段拦截，抢在站点自带的 onclick=window.open 之前
  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('.tpc_content img:not(.spl-emoji), .spl-media img');
    if (!img || img.closest('.spl-gofile') || e.ctrlKey || e.metaKey || e.button !== 0) return;
    if (img.complete && img.naturalWidth <= 120) return;
    e.preventDefault(); e.stopPropagation(); openLightbox(img);
  }, true);

  /* ══════════════════════════════════════════
   * 6. 帖子页：0SP 免刷新自动购买
   *    购买链接形如 job.php?action=buytopic&tid=X&pid=tpc&verify=H&page=1
   *    流程：GET 确认页 → POST step=2 → 重新拉取本页，把该楼层 <td> 换成新内容
   * ══════════════════════════════════════════ */
  function findBuyLinks(root = document) {
    return $$('a[href*="buytopic"], a[onclick*="buytopic"]', root).filter(a => !a.dataset.splBuy);
  }
  function buyUrlOf(a) {
    const href = a.getAttribute('href') || '';
    if (/buytopic/.test(href)) return new URL(href, location.href).href;
    const m = (a.getAttribute('onclick') || '').match(/job\.php\?action=buytopic[^'")\s]*/);
    return m ? new URL(m[0].replace(/&amp;/g, '&'), location.href).href : null;
  }
  function priceOf(a) {
    // 往上找最多 4 层，直到文本里出现“售价 N SP”
    let n = a, depth = 0;
    while (n && depth++ < 4) {
      const m = n.textContent.match(/售价\s*(\d+)\s*(?:SP|sp)/);
      if (m) return +m[1];
      n = n.parentElement;
    }
    return null;
  }
  function postOf(node) { return node.closest('td[id^="td_"]') || node.closest('.tpc_content') || node.closest('table'); }
  function statusLine(anchorEl, cls, text) {
    let line = anchorEl.parentElement.querySelector(':scope > .spl-buy');
    if (!line) { line = el('span', { class: 'spl-buy' }); anchorEl.parentElement.insertBefore(line, anchorEl); }
    line.className = 'spl-buy ' + cls; line.textContent = text;
    return line;
  }

  async function doBuy(url) {
    const doc1 = parseHTML(await siteFetch(url));
    const form = Array.from(doc1.forms).find(f => /buytopic/.test(f.getAttribute('action') || '') || f.querySelector('input[name="step"]'));
    let action = url; const body = new URLSearchParams();
    if (form) {
      action = new URL(form.getAttribute('action') || url, location.href).href;
      $$('input[name], select[name], textarea[name]', form).forEach(i => { if (i.type === 'submit' || i.type === 'button') return; body.set(i.name, i.value); });
    }
    if (!body.has('step')) body.set('step', '2');
    const html2 = await siteFetch(action, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const err = $('#main .t .f_one center, .f_one center', parseHTML(html2));
    return err ? err.textContent.trim() : '';
  }

  async function refreshPost(postEl) {
    const id = postEl.id;
    const doc = parseHTML(await siteFetch(location.href));
    const fresh = id && doc.getElementById(id);
    if (!fresh) return false;
    postEl.innerHTML = fresh.innerHTML;
    $$('.tpc_content', postEl).forEach(c => { delete c.dataset.splDone; enhanceContent(c); });
    if (postEl.classList.contains('tpc_content')) { delete postEl.dataset.splDone; enhanceContent(postEl); }
    return true;
  }

  const buying = new Set();
  async function autoBuy(root = document) {
    const links = findBuyLinks(root);
    links.forEach(a => { a.dataset.splBuy = '1'; });   // 先全部标记，避免 MutationObserver 再次触发时重复处理
    for (const a of links) {
      const url = buyUrlOf(a); if (!url) continue;
      const price = priceOf(a);
      const post = postOf(a);
      if (price == null) { statusLine(a, 'spl-buy-skip', '未识别到售价，未自动购买'); continue; }
      if (price > 0) { statusLine(a, 'spl-buy-skip', `💰 此内容售价 ${price} SP —— 已跳过（本脚本只自动买 0 SP，想买请手动点购买）`); continue; }
      if (!cfg.autoBuyFree) { statusLine(a, 'spl-buy-skip', '0 SP 内容（自动购买已关闭）'); continue; }
      if (buying.has(url)) continue;
      buying.add(url);
      statusLine(a, 'spl-buy-doing', '⏳ 0 SP 内容，正在自动购买并加载…');
      try {
        const err = await doBuy(url);
        if (err && !/成功|已购买|已经购买/.test(err)) throw new Error(err);
        const ok = post && await refreshPost(post);
        if (!ok) { statusLine(a, 'spl-buy-ok', '✅ 已购买，但无法局部刷新，请手动刷新页面'); continue; }
        // 刷新后如果购买按钮还在，说明没买成功，别再循环去买
        const still = findBuyLinks(post);
        if (still.length) still.forEach(b => { b.dataset.splBuy = '1'; statusLine(b, 'spl-buy-err', '❌ 购买请求已发送但内容仍未解锁，请手动点购买'); });
        else toast('✅ 已自动购买 0 SP 内容');
      } catch (e) {
        statusLine(a, 'spl-buy-err', '❌ 自动购买失败：' + e.message + '（可手动点购买）');
      } finally { buying.delete(url); }
    }
  }

  /* ══════════════════════════════════════════
   * 7. 搜索增强
   * ══════════════════════════════════════════ */
  const recentSearches = () => store.get('recent_search', []);
  function pushRecent(q) {
    const list = [q, ...recentSearches().filter(x => x !== q)].slice(0, 12);
    store.set('recent_search', list); store.set('last_keyword', q);
  }
  function goSearch(q) {
    q = q.trim(); if (!q) return;
    pushRecent(q);
    const form = $$('form').find(f => /search\.php/.test(f.getAttribute('action') || '') && $('input[name="keyword"]', f));
    if (form) { $('input[name="keyword"]', form).value = q; applySearchDefaults(form); (form.requestSubmit ? form.requestSubmit() : form.submit()); return; }
    sessionStorage.setItem(NS + 'pending', q);
    location.href = new URL('search.php', location.href).href;
  }
  function applySearchDefaults(form) {
    const time = $('select[name="sch_time"], select[name*="time"]', form);
    if (time && cfg.searchTime && Array.from(time.options).some(o => o.value === cfg.searchTime) && time.value === 'all') time.value = cfg.searchTime;
  }
  function initSearchPage() {
    const form = $$('form').find(f => $('input[name="keyword"]', f));
    if (form) {
      applySearchDefaults(form);
      const kw = $('input[name="keyword"]', form);
      const pending = sessionStorage.getItem(NS + 'pending');
      if (pending) { sessionStorage.removeItem(NS + 'pending'); kw.value = pending; setTimeout(() => (form.requestSubmit ? form.requestSubmit() : form.submit()), 50); }
      form.addEventListener('submit', () => { if (kw.value.trim()) pushRecent(kw.value.trim()); });
      // 最近搜索
      const rec = recentSearches();
      if (rec.length) {
        const wrap = el('div', { class: 'spl-recent', style: 'display:flex;flex-wrap:wrap;gap:5px;margin:6px 0;font-size:12px;' }, '<span style="color:#888">最近：</span>');
        rec.forEach(q => wrap.appendChild(el('span', { style: 'background:#eef2f6;padding:2px 8px;border-radius:10px;cursor:pointer;', onclick: () => goSearch(q) }, esc(q))));
        kw.closest('tr, div, p, form').after(wrap);
      }
    }
    // 结果页：高亮关键词
    const last = store.get('last_keyword', '');
    const words = last.split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (words.length) {
      const re = new RegExp('(' + words.join('|') + ')', 'gi');
      $$('a[href*="read.php?tid"]').filter(isTitleLink).forEach(a => {
        if (a.querySelector('mark')) return;
        a.innerHTML = esc(a.textContent).replace(re, '<mark class="spl-hl">$1</mark>');
      });
    }
  }

  /* ══════════════════════════════════════════
   * 8. 悬浮工具条 + 设置面板
   * ══════════════════════════════════════════ */
  function initToolbar() {
    const bar = el('div', { id: 'spl-bar' });
    const box = el('div', { id: 'spl-search' },
      `<input placeholder="搜索帖子（回车）"><div class="spl-recent"></div><div class="spl-tip">默认范围：${cfg.searchTime === 'all' ? '全部时间' : '最近一年'}，可在设置里改</div>`);
    const input = $('input', box);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') goSearch(input.value); if (e.key === 'Escape') box.classList.remove('open'); });
    const renderRecent = () => { const r = $('.spl-recent', box); r.innerHTML = ''; recentSearches().forEach(q => r.appendChild(el('span', { onclick: () => goSearch(q) }, esc(q)))); };

    if (cfg.floatingSearch) {
      bar.appendChild(el('button', { title: '搜索 (/)', onclick: () => { box.classList.toggle('open'); if (box.classList.contains('open')) { renderRecent(); input.focus(); } } }, '🔍'));
      document.addEventListener('keydown', e => {
        if (e.key === '/' && !e.target.matches('input, textarea, select, [contenteditable]')) { e.preventDefault(); box.classList.add('open'); renderRecent(); input.focus(); }
      });
    }
    bar.appendChild(el('button', { title: '设置', onclick: openSettings }, '⚙'));
    bar.appendChild(el('button', { title: '回到顶部', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, '↑'));
    document.body.append(bar, box);
  }

  const SETTINGS_SCHEMA = [
    ['autoBuyFree',   '自动购买 0 SP 内容（免刷新）', '收费内容永远不会自动买'],
    ['inlineMedia',   '帖内直出图片 / 视频'],
    ['resolveHosts',  '解析图床页面链接', 'imgbox / ibb / postimg / pixhost / imgur / imagebam …'],
    ['gofile',        '解析 Gofile 文件夹缩略图'],
    ['panCards',      '网盘链接卡片 + 提取码识别'],
    ['markVisited',   '已读记忆 + 新回复提示'],
    ['cleanLayout',   '清爽排版', '字号 / 行高 / 图片 / 引用折叠'],
    ['wideMode',      '内容区加宽'],
    ['contentWidth',  '加宽到 (px)', null, 'number'],
    ['fontSize',      '正文字号 (px)', null, 'number'],
    ['hideAvatars',   '隐藏楼层头像资料'],
    ['floatingSearch','右下角悬浮搜索（快捷键 /）'],
    ['searchTime',    '搜索默认时间范围', 'all=全部 86400=一天 604800=一周 2592000=一月 31536000=一年', 'text'],
  ];
  function openSettings() {
    if ($('#spl-mask')) return;
    const panel = el('div', { id: 'spl-panel' }, `<h3>南+ 阅读助手 Lite · 设置</h3>`);
    const inputs = {};
    SETTINGS_SCHEMA.forEach(([key, label, hint, type]) => {
      const lab = el('label', {}, `<span>${label}${hint ? `<small>${hint}</small>` : ''}</span>`);
      const inp = type ? el('input', { type, value: cfg[key] }) : el('input', { type: 'checkbox' });
      if (!type) inp.checked = !!cfg[key];
      inputs[key] = inp; lab.appendChild(inp); panel.appendChild(lab);
    });
    const info = el('div', { style: 'font-size:12px;color:#888;margin-top:10px' }, `已记忆 ${Object.keys(visited).length} 个帖子`);
    panel.appendChild(info);
    const actions = el('div', { class: 'spl-actions' });
    actions.appendChild(el('button', { onclick: () => { if (confirm('清空已读记录？')) { for (const k in visited) delete visited[k]; store.set('visited', {}); info.textContent = '已清空'; } } }, '清空已读'));
    actions.appendChild(el('button', { onclick: () => mask.remove() }, '取消'));
    actions.appendChild(el('button', { class: 'spl-primary', onclick: () => {
      const out = {};
      SETTINGS_SCHEMA.forEach(([key, , , type]) => { out[key] = type === 'number' ? +inputs[key].value : type ? inputs[key].value.trim() : inputs[key].checked; });
      store.set('config', out); location.reload();
    } }, '保存并刷新'));
    panel.appendChild(actions);
    const mask = el('div', { id: 'spl-mask', onclick: e => { if (e.target === mask) mask.remove(); } });
    mask.appendChild(panel); document.body.appendChild(mask);
  }
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('⚙ 南+ 阅读助手设置', openSettings);

  /* ══════════════════════════════════════════
   * 9. 启动
   * ══════════════════════════════════════════ */
  function runReadPage(root = document) {
    $$('.tpc_content', root).forEach(enhanceContent);
    autoBuy(root);
  }

  function boot() {
    initToolbar();
    initKeyPaging();

    if (PAGE === 'read') {
      rememberCurrentThread();
      runReadPage();
    }
    if (PAGE === 'list' || PAGE === 'search' || PAGE === 'index') {
      markVisitedLinks();
      if (PAGE !== 'index') initListFilter();
    }
    if (PAGE === 'search') initSearchPage();

    // 页面里动态加进来的内容（别的脚本无限滚动、站点 ajax 等）也一并处理
    const observer = new MutationObserver(debounce(() => {
      if (PAGE === 'read') runReadPage();
      else markVisitedLinks();
    }, 250));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
