/**
 * 91rb 无限制观看 - QX重写脚本
 *
 * 配合 round-robin 策略组实现：
 *   1. 视频页面可观看时 → 自动缓存视频URL到 persistentStore
 *   2. IP被限时 → 从缓存返回视频URL，注入播放器
 *   3. 无缓存且被限 → 自动刷新换IP重试
 *
 * 缓存格式（persistentStore key: 91rb_video_cache）：
 *   { "视频ID": {"url": "mp4/m3u8地址", "title": "标题", "ts": 时间戳}, ... }
 */

var CACHE_KEY = '91rb_video_cache';

// ==================== 缓存管理 ====================
function loadCache() {
    try {
        var data = $persistentStore.read(CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
}

function saveCache(cache) {
    try { $persistentStore.write(JSON.stringify(cache), CACHE_KEY); } catch (e) {}
}

function getVideoId(url) {
    var m = url.match(/\/videos\/(\d+)\//);
    return m ? m[1] : null;
}

function getVideoTitle(body) {
    var m = body.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/);
    return m ? m[1].trim() : '';
}

// ==================== 从HTML中提取视频URL ====================
function extractVideoUrl(body) {
    // KVS架构视频URL可能在以下位置：
    // 1. <video> 标签的 src 属性
    var m1 = body.match(/<video[^>]*src="([^"]+)"/);
    if (m1) return m1[1];

    // 2. <source> 标签
    var m2 = body.match(/<source[^>]*src="([^"]+)"/);
    if (m2) return m2[1];

    // 3. flashvars.video_url
    var m3 = body.match(/video_url\s*[:=]\s*['"]([^'"]+)['"]/);
    if (m3) return m3[1];

    // 4. flashvars['video_url']
    var m4 = body.match(/flashvars\[['"]video_url['"]\]\s*=\s*['"]([^'"]+)['"]/);
    if (m4) return m4[1];

    // 5. video_src 变量
    var m5 = body.match(/video_src\s*[:=]\s*['"]([^'"]+)['"]/);
    if (m5) return m5[1];

    // 6. file_url 变量
    var m6 = body.match(/file_url\s*[:=]\s*['"]([^'"]+)['"]/);
    if (m6) return m6[1];

    // 7. mp4 URL
    var m7 = body.match(/(https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*)/);
    if (m7) return m7[1];

    // 8. m3u8 URL
    var m8 = body.match(/(https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/);
    if (m8) return m8[1];

    // 9. 相对路径 mp4/m3u8
    var m9 = body.match(/(\/[^"'\s<>]+\.mp4[^"'\s<>]*)/);
    if (m9) return m9[1];

    var m10 = body.match(/(\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/);
    if (m10) return m10[1];

    return null;
}

// ==================== 主逻辑 ====================
var reqUrl = $request.url || '';
var body = $response.body || '';
var videoId = getVideoId(reqUrl);

if (!videoId || !body) {
    $done({});
} else {
    var cache = loadCache();
    var videoUrl = extractVideoUrl(body);
    var hasLimit = body.indexOf('limitplayer') !== -1 || body.indexOf('no-player') !== -1;
    var hasVideo = body.indexOf('<video') !== -1;

    // ====== 情况1：页面有视频URL → 缓存它 ======
    if (videoUrl) {
        cache[videoId] = {
            url: videoUrl,
            title: getVideoTitle(body),
            ts: Date.now()
        };
        saveCache(cache);
        console.log('[91rb] ✅ 缓存视频: ' + videoId + ' → ' + videoUrl);
        $done({});
    }
    // ====== 情况2：IP被限但有缓存 → 注入播放器 ======
    else if (hasLimit && cache[videoId]) {
        var cached = cache[videoId];
        console.log('[91rb] ✅ 从缓存播放: ' + videoId);

        // 替换 no-player 区域为自定义播放器
        var playerHtml = '<div class="player video"><div class="player-holder">' +
            '<video controls autoplay width="100%" style="background:#000;max-height:80vh;" ' +
            'src="' + cached.url + '" poster="https://www.91rb.net/contents/videos_screenshots/' +
            videoId.substring(0, 3) + '000/' + videoId + '/preview.jpg">' +
            '<p>您的浏览器不支持视频播放，请使用Chrome</p></video>' +
            '<div style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.7);color:#2ecc71;' +
            'padding:5px 12px;border-radius:5px;font-size:12px;z-index:9999;">🎬 缓存播放</div>' +
            '</div></div>';

        // 替换 limitplayer 块
        var newBody = body.replace(
            /<div class="player video"[^>]*>[\s\S]*?<\/div><\/div><\/div>/,
            playerHtml
        );

        // 如果替换失败，尝试替换 no-player 块
        if (newBody === body) {
            newBody = body.replace(
                /<div class="no-player"[^>]*>[\s\S]*?<\/div>/,
                '<div class="player-holder"><video controls autoplay width="100%" src="' + cached.url + '"></video></div>'
            );
        }

        $done({ body: newBody });
    }
    // ====== 情况3：IP被限且无缓存 → 注入自动重试脚本 ======
    else if (hasLimit) {
        console.log('[91rb] ❌ IP被限且无缓存: ' + videoId);

        // 注入提示+自动刷新脚本
        var inject = '<script>' +
            '(function(){' +
            'var attempts = parseInt(sessionStorage.getItem("91rb_retry") || "0");' +
            'if (attempts < 8) {' +
            'sessionStorage.setItem("91rb_retry", attempts + 1);' +
            'var tip = document.createElement("div");' +
            'tip.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999999;background:#e74c3c;color:#fff;padding:12px;text-align:center;font-family:sans-serif;font-size:14px;";' +
            'tip.innerHTML = "🔄 IP被限，自动换IP重试中... (" + (attempts+1) + "/8)";' +
            'document.body.appendChild(tip);' +
            'setTimeout(function(){ location.reload(); }, 1500);' +
            '} else {' +
            'sessionStorage.removeItem("91rb_retry");' +
            'var tip2 = document.createElement("div");' +
            'tip2.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999999;background:#e74c3c;color:#fff;padding:12px;text-align:center;font-family:sans-serif;font-size:14px;";' +
            'tip2.innerHTML = "❌ 所有IP都被限，请稍后再试或添加更多节点到91rb-Pool策略组";' +
            'document.body.appendChild(tip2);' +
            '}' +
            '})();' +
            '</script>';

        var newBody = body.replace('</body>', inject + '</body>');
        $done({ body: newBody });
    }
    // ====== 其他情况，不处理 ======
    else {
        $done({});
    }
}
