/**
 * yogamen 原画解锁 - Quantumult X 脚本
 *
 * 工作原理：
 *   1. 拦截 /cn/movie/ 页面 HTML → 修改 isvip="vip" + 注入缓存管理 UI
 *   2. 拦截 /api/getmovie API → 缓存成功的 m3u8 到 persistentStore
 *   3. 原画请求(type=20000)被服务端拒绝时 → 从 persistentStore 缓存返回
 *
 * 缓存格式（persistentStore key: yogamen_hd_cache）：
 *   { "视频ID_20000": {"m3u8": "/videos/日期/ID/文件夹/index.m3u8?random=XXX"}, ... }
 *
 * 使用方法：
 *   1. 有 VIP 账号：登录后切换一次原画，脚本自动缓存到 persistentStore
 *   2. 无 VIP：从他人导出的缓存 JSON 导入（通过页面右下角面板）
 *   3. 之后免登录自动加载原画
 */

const CACHE_KEY = 'yogamen_hd_cache';
const ORIG_TYPE = '20000';

// ==================== persistentStore 读写 ====================
function loadCache() {
    try {
        const data = $persistentStore.read(CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

function saveCache(cache) {
    try {
        $persistentStore.write(JSON.stringify(cache), CACHE_KEY);
    } catch (e) {}
}

function getUrlParam(url, name) {
    const m = url.match(new RegExp(name + '=([^&]+)'));
    return m ? m[1] : null;
}

// ==================== 判断请求类型 ====================
const reqUrl = $request.url || '';
const reqHeaders = $request.headers || {};
const contentType = reqHeaders['Content-Type'] || reqHeaders['content-type'] || '';
const respBody = $response.body || '';
const respContentType = ($response.headers && ($response.headers['Content-Type'] || $response.headers['content-type'])) || '';

// ----- 情况 1：拦截视频页面 HTML -----
if (reqUrl.indexOf('/cn/movie/') !== -1 &&
    (respContentType.indexOf('text/html') !== -1 || respBody.indexOf('<html') !== -1)) {

    let body = respBody;

    // 修改 isvip 状态，让原画选项可选
    if (body.indexOf('isvip = "false"') !== -1) {
        body = body.replace(/isvip = "false"/g, 'isvip = "vip"');
        console.log('[yogamen] ✅ isvip 已修改 → vip');
    }

    // 注入缓存管理脚本
    const injectScript = `
<script>
(function() {
    'use strict';
    var CACHE_KEY = 'yogamen_hd_cache';
    var ORIG_TYPE = '20000';

    function loadCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
        catch(e) { return {}; }
    }
    function saveCache(c) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch(e) {}
    }
    function getVideoId() {
        var m = location.pathname.match(/\\/movie\\/([a-f0-9]+)/);
        return m ? m[1] : null;
    }
    function showToast(msg, isError, duration) {
        duration = duration || 3500;
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;top:90px;right:20px;z-index:999999;background:' +
            (isError ? '#e74c3c' : '#27ae60') + ';color:white;padding:10px 18px;border-radius:6px;' +
            'font-size:13px;max-width:360px;box-shadow:0 4px 12px rgba(0,0,0,0.4);' +
            'transition:opacity 0.3s;opacity:1;font-family:sans-serif;line-height:1.5;';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { t.style.opacity = '0'; setTimeout(function(){t.remove();}, 300); }, duration);
    }

    function waitForPlayer(cb, max) {
        max = max || 60;
        var n = 0;
        function check() {
            n++;
            if (typeof player !== 'undefined' && player && typeof player.load === 'function') {
                cb();
            } else if (n < max) { setTimeout(check, 500); }
        }
        check();
    }

    function waitForjQuery(cb, max) {
        max = max || 100;
        var n = 0;
        function check() {
            n++;
            if (typeof $ !== 'undefined') { $(document).ready(cb); }
            else if (n < max) { setTimeout(check, 100); }
        }
        check();
    }

    waitForjQuery(function() {
        var vid = getVideoId();
        if (!vid) return;

        setTimeout(function() {
            // 重新绑定画质切换事件（覆盖页面原有逻辑）
            $('.hdselect').off('change').on('change', function(e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                var val = $(this).val();
                if (val === 'no') return;

                var cache = loadCache();
                var key = vid + '_' + val;
                var cached = cache[key];

                if (cached && cached.m3u8) {
                    m3u8 = cached.m3u8;
                    player.load(cached.m3u8);
                    showToast(val === ORIG_TYPE ? '已切换到原画（缓存）' : '已切换 480P（缓存）');
                } else {
                    // 无缓存，走 API
                    $.ajax({
                        type: 'GET',
                        url: '/api/getmovie?type=' + val + '&id=' + vid,
                        dataType: 'json',
                        success: function(data) {
                            if (data.message) showToast(data.message, true, 5000);
                            if (data.m3u8) {
                                m3u8 = data.m3u8;
                                player.load(data.m3u8);
                                var c = loadCache();
                                c[key] = { m3u8: data.m3u8, ts: Date.now() };
                                saveCache(c);
                                showToast(val === ORIG_TYPE ? '原画已加载并缓存' : '480P 已加载并缓存');
                            }
                        },
                        error: function() { showToast('请求失败', true); }
                    });
                }
            });

            // 自动切换原画（如果有缓存）
            var cache = loadCache();
            var origKey = vid + '_' + ORIG_TYPE;
            if (cache[origKey] && cache[origKey].m3u8) {
                waitForPlayer(function() {
                    m3u8 = cache[origKey].m3u8;
                    player.load(cache[origKey].m3u8);
                    $('.hdselect').val(ORIG_TYPE);
                    showToast('已自动切换到原画（免登录缓存）');
                });
            } else {
                waitForPlayer(function() {
                    showToast('提示：登录VIP后切一次原画即可缓存，或导入他人缓存', true, 5000);
                });
            }

            // 缓存管理面板
            var bar = document.createElement('div');
            bar.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;' +
                'background:rgba(20,20,20,0.95);color:#aaa;padding:12px 16px;border-radius:8px;' +
                'font-size:12px;font-family:sans-serif;line-height:1.8;max-width:280px;' +
                'box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:opacity 0.3s;';

            function refresh() {
                var c = loadCache();
                var hasOrig = !!c[vid + '_' + ORIG_TYPE];
                var hasNorm = !!c[vid + '_' + '640'];
                var total = Object.keys(c).length;
                bar.innerHTML =
                    '<div style="color:#fff;font-weight:bold;margin-bottom:6px;">画质缓存管理</div>' +
                    '<div>原画: ' + (hasOrig ? '<span style="color:#2ecc71">已缓存</span>' : '<span style="color:#e74c3c">未缓存</span>') + '</div>' +
                    '<div>480P: ' + (hasNorm ? '<span style="color:#2ecc71">已缓存</span>' : '<span style="color:#e74c3c">未缓存</span>') + '</div>' +
                    '<div style="margin-top:4px;color:#666;">总缓存: ' + total + ' 条</div>' +
                    '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
                    '<button id="yga-export" style="background:#333;color:#fff;border:1px solid #555;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;">导出</button>' +
                    '<button id="yga-import" style="background:#333;color:#fff;border:1px solid #555;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;">导入</button>' +
                    '<button id="yga-clear" style="background:#333;color:#fff;border:1px solid #555;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;">清空</button>' +
                    '</div>' +
                    '<div style="margin-top:6px;font-size:10px;color:#555;">VIP用户切原画自动缓存<br>导出JSON可分享给他人</div>';
            }
            refresh();
            document.body.appendChild(bar);

            bar.querySelector('#yga-export').onclick = function() {
                var c = loadCache();
                var blob = new Blob([JSON.stringify(c, null, 2)], {type:'application/json'});
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'yogamen_hd_cache.json';
                a.click();
                showToast('已导出 ' + Object.keys(c).length + ' 条缓存');
            };
            bar.querySelector('#yga-import').onclick = function() {
                var inp = document.createElement('input');
                inp.type = 'file'; inp.accept = '.json';
                inp.onchange = function(e) {
                    var f = e.target.files[0]; if(!f) return;
                    var r = new FileReader();
                    r.onload = function(ev) {
                        try {
                            var imp = JSON.parse(ev.target.result);
                            var ex = loadCache();
                            var merged = Object.assign({}, ex, imp);
                            saveCache(merged);
                            showToast('已导入 ' + Object.keys(imp).length + ' 条缓存');
                            refresh();
                            if (merged[vid + '_' + ORIG_TYPE]) {
                                setTimeout(function() {
                                    var cc = merged[vid + '_' + ORIG_TYPE];
                                    m3u8 = cc.m3u8; player.load(cc.m3u8);
                                    $('.hdselect').val(ORIG_TYPE);
                                }, 1000);
                            }
                        } catch(err) { showToast('导入失败', true); }
                    };
                    r.readAsText(f);
                };
                inp.click();
            };
            bar.querySelector('#yga-clear').onclick = function() {
                if (confirm('确定清空所有缓存？')) {
                    localStorage.removeItem(CACHE_KEY);
                    showToast('已清空'); refresh();
                }
            };

            setTimeout(function() { bar.style.opacity = '0.3'; }, 5000);
            bar.addEventListener('mouseenter', function() { bar.style.opacity = '1'; });
            bar.addEventListener('mouseleave', function() { bar.style.opacity = '0.3'; });
        }, 3000);
    });
})();
</script>`;

    if (body.indexOf('</body>') !== -1) {
        body = body.replace('</body>', injectScript + '\n</body>');
    } else {
        body += injectScript;
    }

    $done({ body: body });
}

// ----- 情况 2：拦截 getmovie API -----
else if (reqUrl.indexOf('/api/getmovie') !== -1) {
    const type = getUrlParam(reqUrl, 'type');
    const videoId = getUrlParam(reqUrl, 'id');

    try {
        const data = JSON.parse(respBody);

        // 情况 2a：API 成功返回 m3u8 → 缓存到 persistentStore
        if (data.m3u8 && type && videoId) {
            const cache = loadCache();
            const cacheKey = videoId + '_' + type;
            cache[cacheKey] = { m3u8: data.m3u8, ts: Date.now() };
            saveCache(cache);
            console.log('[yogamen] ✅ 缓存: video=' + videoId + ' type=' + type);
            // 原样返回
            $done({});
        }
        // 情况 2b：API 返回错误且请求的是原画 → 从 persistentStore 缓存返回
        else if (data.message && type === ORIG_TYPE && videoId) {
            const cache = loadCache();
            const cacheKey = videoId + '_' + ORIG_TYPE;
            const cached = cache[cacheKey];

            if (cached && cached.m3u8) {
                console.log('[yogamen] ✅ 原画从缓存返回: video=' + videoId);
                const cachedResponse = JSON.stringify({ m3u8: cached.m3u8 });
                $done({ body: cachedResponse });
            } else {
                // 无缓存，原样返回错误
                $done({});
            }
        }
        // 情况 2c：其他，不处理
        else {
            $done({});
        }
    } catch (e) {
        $done({});
    }
}

// ----- 其他请求，不处理 -----
else {
    $done({});
}
