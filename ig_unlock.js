
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

  
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * Instagram Native Long-Press Restore (CSS Injection)
 * 
 * 修复原理：
 * 1. 检查 Content-Type，只针对 HTML 页面注入，防止 APP 或 API 崩溃。
 * 2. 注入一段 CSS，强制 img 标签的 pointer-events 为 auto，
 *    并提升 z-index，使其能响应 iOS 原生系统长按。
 */

var body = $response.body;
var headers = $response.headers;
var cType = headers['Content-Type'] || headers['content-type'] || '';

// 【关键】安全检查：如果不是网页，原样放行，绝对不改！
if (cType.indexOf('text/html') === -1) {
    $done({});
} else {
    // 定义要注入的样式
    // pointer-events: auto -> 允许点击
    // -webkit-touch-callout: default -> 允许iOS长按菜单
    var cssFix = `
    <style>
        /* 针对帖子中的图片 */
        article img {
            pointer-events: auto !important;
            -webkit-user-select: auto !important;
            -webkit-touch-callout: default !important;
            position: relative !important;
            z-index: 9999 !important;
        }
        /* 针对帖子中的视频封面 (如果需要) */
        article video {
            pointer-events: auto !important;
            z-index: 9999 !important;
        }
        /* 试图穿透上层遮罩 (辅助) */
        article div[role="button"] {
            /* pointer-events: none; 注意：这可能影响双击点赞，暂且注释，优先提升img层级 */
        }
    </style>
    `;

    // 注入到 head 标签里
    if (body.indexOf('</head>') !== -1) {
        body = body.replace('</head>', cssFix + '</head>');
    } else {
        body = cssFix + body;
    }

    $done({ body: body });
}
