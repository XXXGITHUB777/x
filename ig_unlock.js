/**

 */
[rewrite_local]
# Instagram 网页版：强制开启长按保存 (解锁右键/长按限制)
^https?:\/\/(www\.)?instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * Instagram Reader Mode Mimic for Quantumult X
 * 原理：在原始图片之上，覆盖一张完全纯净的、无事件绑定的克隆图片
 * 从而骗过 Safari，实现 100% 原生长按保存体验
 */

/**
 * Instagram Native Interaction Restorer
 * 
 * 功能：将覆盖在图片上的 UI 图层设置为“点击穿透”，
 * 从而恢复浏览器原本的图片长按菜单 (Save to Photos)。
 */

var body = $response.body;

// 注入的 HTML 代码片段
// 使用 MutationObserver 监听动态加载的内容
var scriptContent = `
<script>
(function() {
    'use strict';

    // 定义一个 CSS 样式块，强制让图片接收点击，而其父级容器的遮罩层不接收点击
    // _aagw 是 IG 目前常用的遮罩层 class，但为了保险，我们使用通用规则
    const css = \`
        article img {
            pointer-events: auto !important;
            z-index: 999 !important;
            user-select: auto !important;
            -webkit-user-select: auto !important;
            -webkit-touch-callout: default !important;
        }
        /* 这是一个关键策略：让图片的所有兄弟元素（即遮罩层）失去点击能力 */
        article div[class*="_"] {
            /* pointer-events: none !important;  <-- 注意：这可能会影响多图滑动，下面用 JS 精细控制 */
        }
    \`;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);

    // 核心处理函数
    function enableLongPress() {
        // 找到所有帖子里的图片
        const images = document.querySelectorAll('article img');
        
        images.forEach(img => {
            // 1. 确保图片本身可以响应触摸
            img.style.pointerEvents = 'auto';
            img.style.webkitTouchCallout = 'default';

            // 2. 寻找“罪魁祸首”：挡在图片前面的透明遮罩 div
            // 在 IG 的结构中，图片通常在一个 div 里面，而这个 div 旁边或者上面还有其他 div 负责拦截点击
            // 我们向上遍历两层，找到那个负责布局的容器
            let container = img.closest('div');
            if (container) {
                // 让容器本身不要拦截点击，但不要隐藏它（否则排版会乱）
                // 仅仅是让点击事件“穿透”它，到达 img
                // 注意：我们不能粗暴地对所有父级设 none，否则无法滑动轮播图
                
                // 针对 IG 特定的遮罩层 (通常是紧贴着 img 的那个父级或兄弟级)
                // 如果是单图，直接穿透父级通常没问题
                let overlay = img.parentElement;
                if (overlay) {
                     // 只有当手指点在图片区域时，才让上层忽略点击
                     overlay.style.pointerEvents = 'none';
                }
            }
        });
    }

    // 启动监听器，因为 IG 是动态加载的
    const observer = new MutationObserver((mutations) => {
        enableLongPress();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始化执行
    setTimeout(enableLongPress, 1000);
    setTimeout(enableLongPress, 3000); // 双重保险
})();
</script>
`;

// 安全地注入代码
if (body && body.indexOf('</body>') !== -1) {
    body = body.replace('</body>', scriptContent + '</body>');
}

$done({ body });

