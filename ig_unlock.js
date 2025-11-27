
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

  
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com
/**
 * Instagram Web Native Save for Quantumult X
 * * 功能：
 * 1. 移除 CSP 策略，允许脚本执行。
 * 2. 注入 JS，自动穿透 Instagram 的遮罩层，实现长按 img 标签直接唤起 iOS 菜单。
 * 3. 严格过滤 Content-Type，防止破坏 JSON 导致白屏。
 */

const url = $request.url;
const method = $request.method;
const headers = $response.headers;
let body = $response.body;

// 【关键修正 1】严格过滤 Content-Type
// 只有当响应是 HTML 页面时才注入，绝对不能修改 application/json 或其他 API 数据
const contentType = headers['Content-Type'] || headers['content-type'] || '';
if (!contentType.includes('text/html')) {
    $done({}); // 直接返回，不做任何修改
}

// 【关键修正 2】移除 CSP (Content-Security-Policy)
// 这确保了我们在 Body 中注入的 inline-script 能够被浏览器执行
const cspHeaders = [
    'Content-Security-Policy',
    'content-security-policy',
    'Content-Security-Policy-Report-Only',
    'content-security-policy-report-only'
];

cspHeaders.forEach(key => {
    if (headers[key]) delete headers[key];
});

// 【核心逻辑】注入穿透脚本
// 我们将脚本注入到 </body> 标签之前
const injectionScript = `
<script>
(function() {
    console.log('IG Native Save: Script Started');

    // 样式注入：强制图片响应交互，并移除常见的遮罩层交互
    const css = \`
        /* 强制图片接收点击和触摸事件 */
        article img, main img, ._aagv img { 
            pointer-events: auto !important; 
            z-index: 99 !important; 
            position: relative !important;
            touch-action: pan-y !important; /* 关键：保留垂直滚动能力 */
            user-select: none !important;
            -webkit-user-select: none !important;
            -webkit-touch-callout: default !important; /* 恢复 iOS 长按菜单 */
        }
        
        /* 穿透常见的遮罩层类名 (Instagram 动态类名 _aagw 等) */
        ._aagw, ._aagv, div[role="button"] > div {
            pointer-events: none !important;
        }

        /* 修复轮播图箭头：让左右箭头依然可点击 */
        button[class*="_"], [role="button"] {
            pointer-events: auto !important;
            z-index: 100 !important; /* 确保箭头在图片之上 */
        }
        
        /* 可选：给可保存的图片加一个微弱的绿色边框作为提示 */
        img[data-ig-save-ready="true"] {
            border: 1px solid rgba(0, 255, 0, 0.3);
        }
    \`;
    
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // DOM 监听与处理逻辑
    function enableLongPress() {
        // 获取所有潜在的主图片
        // Instagram 图片通常在 article 标签内，或者带有特定的 sizes 属性
        const images = document.querySelectorAll('img');

        images.forEach(img => {
            if (img.getAttribute('data-ig-save-ready')) return; // 避免重复处理
            
            // 过滤掉头像、小图标 (通常小于 50px)
            if (img.width < 50 || img.height < 50) return;

            // 标记已处理
            img.setAttribute('data-ig-save-ready', 'true');
            
            // 强制移除父级可能的遮挡
            // 有些时候 pointer-events: none 的 CSS 还是会被 React 事件捕获覆盖
            // 这里我们尝试“提升”图片
            let parent = img.parentElement;
            if(parent) {
                // 确保父级不拦截
                // parent.style.pointerEvents = 'none'; 
                // 注意：不能无脑设置父级 none，可能会导致整个卡片无法点击进入详情
            }
        });
    }

    // 使用 MutationObserver 处理无限滚动加载的内容
    const observer = new MutationObserver((mutations) => {
        enableLongPress();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始运行
    setTimeout(enableLongPress, 1000);
    window.addEventListener('load', enableLongPress);

})();
</script>
`;

// 将脚本插入到 body 结束标签前
if (body) {
    body = body.replace('</body>', `${injectionScript}</body>`);
}

$done({ headers: headers, body: body });
