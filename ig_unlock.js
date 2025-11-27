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

let body = $response.body;

const injectCode = `
<script>
(function() {
    console.log("[IG-Mimic] 脚本启动，准备克隆图片层...");

    // 核心函数：处理单张图片
    function processImage(originalImg) {
        // 1. 检查是否已经处理过 (防止无限克隆)
        if (originalImg.getAttribute('data-ig-mimic') === 'true') return;
        if (originalImg.classList.contains('ig-mimic-clone')) return;

        // 2. 找到图片所在的容器 (通常是 _aagv 或类似结构)
        // 这一步是为了确保克隆图的位置和原图完全重合
        let container = originalImg.closest('div'); 
        if (!container) return;

        // 3. 获取最高清的图片地址
        // IG 的图片通常在 srcset 里，或者就是 src
        let highResUrl = originalImg.src;
        if (originalImg.srcset) {
            // 简单的取出 srcset 中最后那个 url (通常是最大的)
            let sources = originalImg.srcset.split(',');
            let lastSource = sources[sources.length - 1].trim();
            let urlPart = lastSource.split(' ')[0];
            if (urlPart) highResUrl = urlPart;
        }

        // 4. 创建“幽灵”克隆图 (The Reader Mode Element)
        // 这是一个纯净的 HTML 元素，没有绑定 React 事件
        let cloneImg = document.createElement('img');
        cloneImg.src = highResUrl;
        cloneImg.className = 'ig-mimic-clone';
        
        // 5. 设置样式：绝对定位，覆盖在原图之上，且层级最高
        cloneImg.style.cssText = \`
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 9999 !important; 
            opacity: 0.01 !important; /* 几乎透明，只为了响应触摸，不影响视觉 */
            pointer-events: auto !important;
            -webkit-touch-callout: default !important;
            -webkit-user-select: auto !important;
        \`;

        // 6. 标记原图已处理
        originalImg.setAttribute('data-ig-mimic', 'true');

        // 7. 插入 DOM
        // 必须插入到 container 的最后，确保在最上层
        // 并且添加位置属性给父级，保证 absolute 定位准确
        let computedStyle = window.getComputedStyle(container);
        if (computedStyle.position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(cloneImg);

        console.log("[IG-Mimic] 已覆盖一张纯净图片");
    }

    // 启动观察者：因为 IG 是无限滚动，必须持续监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
        // 查找页面内所有的 article 图片
        // 选择器 article img 是为了精准定位帖子内的图，避开头像等
        let images = document.querySelectorAll('article img');
        images.forEach(img => {
            // 过滤掉非常小的图(可能是表情包或图标)
            if (img.width > 100 || img.naturalWidth > 100) {
                processImage(img);
            }
        });
    });

    // 开始监听
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // 首次加载也执行一次
    setTimeout(() => {
        let images = document.querySelectorAll('article img');
        images.forEach(img => { if(img.width > 50) processImage(img); });
    }, 1500);

})();
</script>
`;

if (body.indexOf('</body>') !== -1) {
    body = body.replace('</body>', injectCode + '</body>');
}

$done({ body });
