/**
 * KBJFan韩国热舞VIP视频解锁 - Quantumult X 版本
 * @author w2f (adapted for QX)
 *
 * 原理：网站用 Cookie "free_play" 限制试看次数，free_play < 3 时可播放。
 *       原油猴脚本通过 document.cookie 修改，QX 则在请求头中注入 free_play=0。
 *
 * ======================== 使用方法 ========================
 *
 * 1. 将本文件放入 QX 脚本目录（如 iCloud/QuantumultX/Scripts/）
 *
 * 2. 在 [rewrite_local] 添加：
 *    ^https?://(www\.)?kbjfan\.com url script-request-header kbjfan_bypass_qx.js
 *
 * 3. 在 [mitm] 添加：
 *    hostname = www.kbjfan.com, kbjfan.com
 *
 * 4. 保存并重启 QX（或刷新配置）
 *
 * ==========================================================
 */

var headers = $request.headers;
var cookie = headers['Cookie'] || headers['cookie'] || '';

// 替换已有的 free_play 值，或追加 free_play=0
if (cookie) {
    if (/free_play=\d+/.test(cookie)) {
        cookie = cookie.replace(/free_play=\d+/, 'free_play=0');
    } else {
        cookie += '; free_play=0';
    }
} else {
    cookie = 'free_play=0';
}

headers['Cookie'] = cookie;

$done({ headers: headers });
