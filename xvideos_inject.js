# 配置文件: xvideos-优化
# 功能: 去广告、自动宽屏、高画质、观看历史隐藏、稍后观看等
# 适用: Quantumult X

[rewrite_local]
# 匹配 xvideos 所有页面进行注入
^https?:\/\/.*\.xvideos\.com\/.* url script-response-body https://raw.githubusercontent.com/yours/path/xvideos_inject.js

[mitm]
hostname = *.xvideos.com

/**
 * @name Xvideos 优化注入版
 * @description 适配 QX，将油猴脚本逻辑注入到页面中
 */

let body = $response.body;

// 核心 CSS (提取自原脚本)
const cssStyle = `
/* 隐藏广告元素 */
#warning-survey, #video-right, #ad-footer { display: none !important; }
.head__menu-line__main-menu__lvl1.red-ticket,
.head__menu-line__main-menu__lvl1.live-cams,
.head__menu-line__main-menu__lvl1.nutaku-games,
.head__menu-line__main-menu__lvl1.ignore-popunder { display: none !important; }
a[href*="xvideos.red/red/videos"], a[href*="zlinkt.com"], a[href*="nutaku.net"] { display: none !important; }
li:has(> a[href*="xvideos.red/red/videos"]), li:has(> a[href*="zlinkt.com"]), li:has(> a[href*="nutaku.net"]) { display: none !important; }
div[style*="background: rgb(222, 38, 0)"], div[id*="9o6lsm8aj09wav6bf9"] { display: none !important; }
p:has(> a[href*="xvideos.red?pmsc=header_adblock"]) { display: none !important; }
.premium-results-line, .premium-search-on-free, div[class*="premium-results"], .thumb-block.premium-search-on-free { display: none !important; }
.thumb-block:has(.is-purchased-mark), .thumb-under:has(.is-purchased-mark) { display: none !important; }
a[href*="/c/p:1/"]:has(.icon-f.icf-ticket-red), a.see-more:has(.icon-f.icf-ticket-red) { display: none !important; }
div:has(> .premium-results-line-title), div:has(> .premium-results-line-see-more) { display: none !important; }
.xv-fade-in { animation: xvFadeIn 300ms ease-in-out; }
@keyframes xvFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
#recent-tags-container { background: #f5f7fa !important; border-bottom: 1px solid #e5e7eb; padding: 6px 10px; line-height: 1; }
#recent-tags-container .xv-title { font-weight: 600; color: #374151; margin-right: 8px; }
#recent-tags-container .xv-tag { display: inline-block; font-size: 12px; color: #374151; text-decoration: none; background: #ffffff; border: 1px solid #d1d5db; border-radius: 999px; padding: 3px 10px; margin: 0 3px; }
#recent-tags-container .xv-tag:hover { background: #f9fafb; border-color: #9ca3af; }
.xv-watchlater-remove { position: absolute; right: 6px; bottom: 6px; width: 26px; height: 26px; border-radius: 50%; background: rgba(239,68,68,.92); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: 700; line-height: 1; box-shadow: 0 2px 6px rgba(0,0,0,.25); z-index: 5; }
.xv-watchlater-remove:hover { background: rgba(220,38,38,.98); }
.xv-watchlater-remove .xv-remove-icon { pointer-events: none; font-size: 16px; }
.xv-eye-icon { transition: all 0.3s ease; }
#xv-hide-watched-menu-item .head__menu-line__main-menu__lvl1:hover .xv-eye-icon { color: #d32f2f !important; }
#xv-hide-watched-menu-item .head__menu-line__main-menu__lvl1:active .xv-eye-icon { color: #b71c1c !important; }
`;

// 核心 JS 逻辑 (原脚本逻辑，Polyfill 了 GM_ 函数)
const injectionCode = `
(function() {
    "use strict";
    
    // Polyfill GM functions using standard Browser API
    const GM_addStyle = (css) => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    };
    const GM_getValue = (key, def) => {
        const val = localStorage.getItem(key);
        return val === null ? def : val;
    };
    const GM_setValue = (key, val) => {
        localStorage.setItem(key, val);
    };
    const GM_deleteValue = (key) => {
        localStorage.removeItem(key);
    };

    const CONFIG = { storageKeys: { recentTags: "xv_recent_tags", hideWatched: "xv_hide_watched" }, ui: { maxTags: 25, debounceDelay: 300 } };

    // 注入 CSS
    GM_addStyle(\`${cssStyle.replace(/`/g, '\\`')}\`);

    class Storage {
        static get(e, t = null) {
            try { const n = GM_getValue(e); if (null == n) return t; try { return JSON.parse(n) } catch { return n } } catch (n) { return t }
        }
        static set(e, t) {
            try { const n = JSON.stringify(t); return GM_setValue(e, n), !0 } catch (n) { return !1 }
        }
    }

    function debounce(e, t) { let n; return (...i) => { clearTimeout(n), n = setTimeout(() => e(...i), t) } }
    
    const e = {
        select(e, t = document) { return t.querySelector(e) },
        selectAll(e, t = document) { return t.querySelectorAll(e) },
        create(e, t = {}, n = "") {
            const i = document.createElement(e);
            return Object.entries(t).forEach(([e, t]) => {
                "className" === e ? i.className = t : "style" === e && "object" == typeof t ? Object.assign(i.style, t) : e.startsWith("on") && "function" == typeof t ? i.addEventListener(e.slice(2), t) : i.setAttribute(e, t)
            }), n && (i.innerHTML = n), i
        }
    };

    const t = Storage;

    class AdBlocker {
        static init() { this.setupDynamicAdRemoval() }
        static setupDynamicAdRemoval() {
            document.addEventListener("DOMContentLoaded", () => {
                this.removeRedBanner(), this.removeMenuAds(), this.removePremiumAds(), this.observeAds()
            })
        }
        static removeRedBanner() {
            const t = e.select('a[href*="xvideos.red?pmsc=header_adblock"]');
            if (t) { const e = t.closest('div[style*="background: rgb(222, 38, 0)"]'); e && !e.dataset.xvRemoved && (e.remove(), e.dataset.xvRemoved = "true") }
        }
        static removeMenuAds() {
            [".head__menu-line__main-menu__lvl1.red-ticket", ".head__menu-line__main-menu__lvl1.live-cams", ".head__menu-line__main-menu__lvl1.nutaku-games", ".head__menu-line__main-menu__lvl1.ignore-popunder", 'a[href*="xvideos.red/red/videos"]', 'a[href*="zlinkt.com"]', 'a[href*="nutaku.net"]'].forEach(n => {
                e.selectAll(n).forEach(e => { if (e && !e.dataset.xvRemoved) { const n = e.closest("li") || e; n.dataset.xvRemoved || (n.remove(), n.dataset.xvRemoved = "true") } })
            });
        }
        static removePremiumAds() {
             [".premium-results-line", ".premium-search-on-free", 'div[class*="premium-results"]', ".thumb-block.premium-search-on-free", 'a[href*="/c/p:1/"]'].forEach(t => {
                e.selectAll(t).forEach(e => { e && !e.dataset.xvPremiumRemoved && (e.remove(), e.dataset.xvPremiumRemoved = "true") })
            });
        }
        static observeAds() {
            new MutationObserver(debounce(() => { this.removeRedBanner(), this.removeMenuAds(), this.removePremiumAds() }, CONFIG.ui.debounceDelay)).observe(document.body, { childList: !0, subtree: !0 })
        }
    }

    // 自动播放与宽屏
    function n() {
        setTimeout(() => {
            try {
                if ("undefined" != typeof html5player && html5player) {
                    if("function" == typeof html5player.toggleExpand) html5player.toggleExpand(); // 自动宽屏
                    
                    // 自动高画质
                    if(html5player.hlsobj && html5player.hlsobj.levels && html5player.hlsobj.levels.length > 0){
                        const e = Math.min(4, html5player.hlsobj.levels.length - 1);
                        const t = html5player.hlsobj;
                        void 0 !== t.loadLevel && (t.loadLevel = e)
                    }
                    
                    // 自动播放
                    if("function" == typeof html5player.play && !html5player.playClicked) {
                        setTimeout(() => {
                            html5player && !html5player.playClicked && html5player.play && (html5player.playClicked = !0, html5player.play())
                        }, 200)
                    }
                }
            } catch (e) {}
        }, 800)
    }

    // 近期标签相关
    function i() {
        const e = document.querySelector(".listing_filters");
        if (e) return { node: e, position: "beforebegin" };
        const t = document.querySelector(".head__menu-line");
        if (t) return { node: t, position: "afterend" };
        return null
    }
    function a() {
        const e = i();
        if (e && !document.getElementById("recent-tags-container")) {
            const t = document.createElement("div");
            t.id = "recent-tags-container", e.node.insertAdjacentElement(e.position, t)
        }
        c()
    }
    function s() { return t.get(CONFIG.storageKeys.recentTags, []) ?? [] }
    function r(e) { t.set(CONFIG.storageKeys.recentTags, e) }
    function o(e) {
        let t = s();
        t = t.filter(t => t.href !== e.href), t.unshift(e), t.length > CONFIG.ui.maxTags && (t = t.slice(0, CONFIG.ui.maxTags)), r(t)
    }
    function c() {
        const e = document.getElementById("recent-tags-container");
        if (!e) return;
        e.innerHTML = "";
        const t = s(), n = document.createElement("div");
        if (n.className = "xv-tags", e.appendChild(n), t.length > 0) {
            const e = document.createElement("span");
            e.className = "xv-title", e.textContent = "近期标签:", n.appendChild(e), t.forEach(e => {
                const t = document.createElement("a");
                t.href = e.href, t.textContent = e.text, t.className = "xv-tag", n.appendChild(t)
            })
        }
    }

    // 标签点击监听
    document.addEventListener("click", function(e) {
        const t = e.target ?.closest("a");
        t && t.classList.contains("is-keyword") && t.getAttribute("href") && (o({ text: t.textContent ?.trim() || "", href: t.getAttribute("href") || "" }), c())
    });

    // 隐藏已观看
    const l = class {
        static init() { this.loadState(), this.isListingPage() && (this.setupObserver(), this.isEnabled && (this.applyHiding(), setTimeout(() => this.applyHiding(), 2e3))) }
        static loadState() { this.isEnabled = t.get(CONFIG.storageKeys.hideWatched, !1) ?? !1 }
        static toggle(e) { this.isEnabled = e, t.set(CONFIG.storageKeys.hideWatched, e), e ? (this.applyHiding(), setTimeout(() => this.applyHiding(), 500)) : this.showAllVideos() }
        static applyHiding() { this.isEnabled && e.selectAll(".thumb-block:not([data-xv-hidden]), .video-container:not([data-xv-hidden])").forEach(e => { this.isWatchedCard(e) && (e.style.display = "none", e.dataset.xvHidden = "1") }) }
        static isWatchedCard(e) { return !(!e || !e.classList.contains("viewed") && !e.querySelector(".video-viewed") && !e.querySelector(".viewedIcon")) }
        static showAllVideos() { e.selectAll('[data-xv-hidden="1"]').forEach(e => { e.style.display = "", delete e.dataset.xvHidden }) }
        static setupObserver() { new MutationObserver(debounce(() => { this.isEnabled && this.applyHiding() }, CONFIG.ui.debounceDelay)).observe(document.body, { childList: !0, subtree: !0 }) }
        static isListingPage() { return "other" !== this.getCurrentPageType() }
        static getCurrentPageType() { const e = location.pathname || ""; return e.startsWith("/video") ? "video" : "other" } // 简化判断
    };
    l.isEnabled = !1;
    let d = l;

    // 菜单集成
    class MenuIntegration {
        static init() { this.addHideWatchedMenuItem(), setTimeout(() => { if (d) { const e = t.get(CONFIG.storageKeys.hideWatched, !1) ?? !1; this.updateMenuItemState(e) } }, 100) }
        static addHideWatchedMenuItem() {
            if (e.select("#xv-hide-watched-menu-item")) return;
            let t = e.select(".head__menu-line__main-menu") || e.select(".header-bottom-inner") || e.select(".head__menu-line");
            if (!t) return;
            const i = this.createHideWatchedMenuItem("main-menu");
            t.appendChild(i)
        }
        static createHideWatchedMenuItem(n) {
            const i = t.get(CONFIG.storageKeys.hideWatched, !1) ?? !1;
            const wrapper = e.create("li", { id: "xv-hide-watched-menu-item" });
            const link = e.create("a", { className: "head__menu-line__main-menu__lvl1", href: "#", onclick: e => { e.preventDefault(), this.toggleHideWatched() } });
            const txt = e.create("span", {}, i ? " 隐藏已观看 " : " 显示已观看 ");
            link.appendChild(txt); wrapper.appendChild(link); return wrapper;
        }
        static toggleHideWatched() { const e = !t.get(CONFIG.storageKeys.hideWatched, !1); t.set(CONFIG.storageKeys.hideWatched, e), this.updateMenuItemState(e), d && d.toggle(e) }
        static updateMenuItemState(t) {
            const n = e.select("#xv-hide-watched-menu-item a span");
            if (n) n.textContent = t ? " 隐藏已观看 " : " 显示已观看 ";
        }
    }

    // WatchLater (简化版，只保留移除按钮逻辑，网络请求需环境支持)
    const m = class _WatchLaterManager {
        static init() { if (!location.pathname.startsWith("/watch-later")) return; this.setupObserver(), this.addRemoveButtons() }
        static setupObserver() { new MutationObserver(debounce(() => { this.addRemoveButtons() }, CONFIG.ui.debounceDelay)).observe(document.body, { childList: !0, subtree: !0 }) }
        static addRemoveButtons() {
            e.selectAll(".video-container, .thumb-block").forEach(e => {
                if ("1" === e.dataset.xvRemBtn) return;
                const t = e.querySelector(".video-thumb, .thumb, a:has(img), .thumb-inside");
                const i = e.dataset.id;
                if (t && i) this.addRemoveButton(e, i, t)
            })
        }
        static addRemoveButton(t, n, i) {
            const a = e.create("div", { className: "xv-watchlater-remove", title: "移除", onclick: e => { e.preventDefault(), e.stopPropagation(), this.removeFromWatchLater(n, t) } }, "×");
            "static" === getComputedStyle(i).position && (i.style.position = "relative"), i.appendChild(a), t.dataset.xvRemBtn = "1"
        }
        static async removeFromWatchLater(e, t) {
            // QX 环境下Fetch可能受限，这里仅尝试UI移除
            t && t.remove();
        }
    };

    // 启动
    AdBlocker.init();
    document.addEventListener("DOMContentLoaded", () => {
        MenuIntegration.init();
        a();
        l.init();
        m.init();
        if (window.location.href.includes("/video")) n();
    });
    // 防止 SPA 切换失效
    window.addEventListener("load", () => {
        if (window.location.href.includes("/video")) setTimeout(() => n(), 1000);
    });

})();
`;

if (body.indexOf("</body>") !== -1) {
    body = body.replace("</body>", `<script>${injectionCode}</script></body>`);
}

$done({ body });
