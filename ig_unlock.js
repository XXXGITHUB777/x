
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

  
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com
/**
 * Instagram Native Restore (Safe Fix Version)
 * 修复“打不开”问题：增加了 Content-Type 检查，只针对 HTML 页面注入。
 * 功能：通过 CSS 强制让图片图层置顶，恢复 iOS 原生菜单。
 */

var body = $response.body;
var headers = $response.headers;

// --- 核心修复：防崩溃检查 ---
// 如果没有 Content-Type 头，或者类型不是 HTML 网页
// 直接原样放行，绝对不修改，防止网页白屏/崩溃
var cType = headers['Content-Type'] || headers['content-type'] || '';
if (cType.indexOf('text/html') === -1) {
    $done({}); 
} else {
    // --- 注入逻辑 ---
    // 不使用复杂的 JS，仅注入 CSS 样式表
    // 这比 JS 更稳定，不易受 CSP 策略影响
    var styleTag = `
    <style>
        /* 1. 强制图片响应点击和长按 */
        article img {
            /* 允许点击穿透 */
            pointer-events: auto !important;
            /* 允许系统长按菜单 */
            -webkit-touch-callout: default !important;
            /* 允许用户选中 */
            -webkit-user-select: auto !important;
            user-select: auto !important;
            /* 提升层级，压在遮罩层上面 */
            position: relative !important;
            z-index: 999 !important;
        }

        /* 2. 处理多图轮播的容器 */
        /* 这一步是为了防止滑动手势失效 */
        article ul li {
            -webkit-user-select: none;
        }

        /* 3. (可选) 视觉反馈：给图片加个极细微的边框，证明脚本生效了 */
        article img {
            border: 1px solid rgba(255,255,255,0.2) !important;
        }
    </style>
    `;

    // 将样式插入到 <head> 中
    if (body.indexOf('</head>') !== -1) {
        body = body.replace('</head>', styleTag + '</head>');
    } else {
        body = styleTag + body;
    }

    $done({ body: body });
}
