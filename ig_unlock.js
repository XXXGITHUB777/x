
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

  
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * Instagram Force Reader-Like Mode
 * 
 * 核心原理：
 * 不使用任何 JS 执行逻辑（避开 CSP 拦截）。
 * 仅注入 CSS，利用 pointer-events 属性，
 * 物理穿透 IG 的遮罩层，强制恢复 img 标签的原生 iOS 长按功能。
 */

var body = $response.body;
var headers = $response.headers;
var cType = headers['Content-Type'] || headers['content-type'] || '';

// 【绝对防御】
// 只有当 content-type 包含 text/html 时才运行。
// 这能 100% 避免修改 JSON 数据导致的页面白屏/打不开。
if (cType.indexOf('text/html') === -1) {
    $done({});
} else {
    // 注入的 CSS 样式表
    var style = `
    <style>
    /* --- 核心：强制图片图层置顶 --- */
    article img {
        /* 1. 允许接收点击 (穿透原本的禁用设置) */
        pointer-events: auto !important;
        
        /* 2. 恢复 iOS 原生菜单 (关键) */
        -webkit-touch-callout: default !important;
        
        /* 3. 允许选中 */
        -webkit-user-select: auto !important;
        user-select: auto !important;
        
        /* 4. 提升层级，压制住原本盖在上面的 div */
        position: relative !important;
        z-index: 99999 !important;
        
        /* 5. 视觉反馈：加一个微弱的边框，让你知道脚本生效了 */
        border: 1px solid rgba(255,255,255,0.3) !important;
    }

    /* --- 辅助：处理视频封面 --- */
    article video {
        pointer-events: auto !important;
        z-index: 99999 !important;
    }

    /* --- 进阶：模拟阅读模式 (清理干扰) --- */
    /* 如果你想让图片更纯净，可以把覆盖层设为穿透，但为了防滑动手势失效，这里只做图片提升 */
    </style>
    `;

    // 将样式插入到网页头部
    if (body.indexOf('</head>') !== -1) {
        body = body.replace('</head>', style + '</head>');
    } else {
        body = style + body;
    }

    $done({ body: body });
}
