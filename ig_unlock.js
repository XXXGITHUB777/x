/**

 */
[rewrite_local]
# Instagram 网页版：强制开启长按保存 (解锁右键/长按限制)
^https?:\/\/(www\.)?instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * Instagram Focus Mode for Quantumult X
 * 
 * 原理：
 * 1. 监听用户在帖子区域的“长按”动作。
 * 2. 一旦检测到长按，脚本提取当前图片的高清地址。
 * 3. 弹出一个全屏的“纯净预览窗口”。
 * 4. 用户在预览窗口再次长按，即可完美触发 iOS 原生保存菜单。
 * 
 * 解决痛点：彻底绕过 IG 的 JS 拦截和透明遮罩，不影响轮播图滑动。
 */

var body = $response.body;

var scriptContent = `
<script>
(function() {
    console.log("✅ IG Focus Mode Loaded");

    // 样式定义：纯净预览层的样式
    const style = document.createElement('style');
    style.innerHTML = \`
        #ig-focus-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none; /* 默认不阻挡，激活时开启 */
        }
        #ig-focus-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        #ig-focus-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            -webkit-touch-callout: default !important; /* 关键：允许系统菜单 */
            user-select: auto !important;
            pointer-events: auto !important;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }
        #ig-focus-close {
            position: absolute;
            top: 40px; right: 20px;
            color: white;
            font-size: 24px;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            width: 40px; height: 40px;
            border-radius: 50%;
            text-align: center;
            line-height: 40px;
        }
        #ig-focus-tip {
            position: absolute;
            bottom: 40px;
            color: white;
            font-size: 14px;
            background: rgba(0,0,0,0.5);
            padding: 8px 16px;
            border-radius: 20px;
        }
    \`;
    document.head.appendChild(style);

    // 创建预览层 DOM
    const overlay = document.createElement('div');
    overlay.id = 'ig-focus-overlay';
    overlay.innerHTML = \`
        <div id="ig-focus-close">×</div>
        <img id="ig-focus-img" src="" />
        <div id="ig-focus-tip">再次长按图片保存 • 点击任意处关闭</div>
    \`;
    document.body.appendChild(overlay);

    const focusImg = document.getElementById('ig-focus-img');

    // 关闭逻辑
    overlay.addEventListener('click', (e) => {
        if (e.target !== focusImg) {
            overlay.classList.remove('active');
            focusImg.src = ''; // 清空
        }
    });

    // --- 核心逻辑：手势监听 ---
    let pressTimer = null;
    let startX, startY;
    let isScrolling = false;

    // 监听全局触摸开始
    document.addEventListener('touchstart', (e) => {
        // 只有点击了 article 内部（帖子区域）才触发
        const target = e.target;
        const article = target.closest('article');
        
        if (!article) return;

        // 记录起始坐标，用于判断是否移动了手指（是否在滑动）
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isScrolling = false;

        // 开启定时器：600ms 后触发 Focus Mode
        pressTimer = setTimeout(() => {
            if (!isScrolling) {
                // 尝试找到当前点击区域对应的图片
                let imgUrl = findBestImage(target, article);
                if (imgUrl) {
                    triggerFocusMode(imgUrl);
                }
            }
        }, 600); // 长按 0.6秒 触发
    }, { passive: true });

    // 监听触摸移动
    document.addEventListener('touchmove', (e) => {
        if (!pressTimer) return;
        
        const moveX = e.touches[0].clientX;
        const moveY = e.touches[0].clientY;
        
        // 如果移动超过 10px，视为滑动，取消长按逻辑
        if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
            isScrolling = true;
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }, { passive: true });

    // 监听触摸结束
    document.addEventListener('touchend', () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }, { passive: true });

    // 辅助函数：从点击目标附近寻找高清图
    function findBestImage(target, article) {
        // 1. 尝试直接看目标是不是 img
        if (target.tagName === 'IMG') return target.src;

        // 2. 尝试找目标容器内的 img (针对有遮罩的情况)
        // 我们需要判断是单图还是轮播
        // 简单的逻辑：查找当前可见的图片
        
        // 获取 article 内所有图片
        const imgs = article.querySelectorAll('img');
        
        // 遍历图片，找到距离点击位置最近的那个图片，且必须是可见的
        // 简易版：直接找 target 下面是否有 img，或者 target 的父级 sibling 是否有 img
        // 由于 IG 结构复杂，我们使用“可视区域检测”法
        
        let bestImg = null;
        let minDist = Infinity;

        imgs.forEach(img => {
            // 排除头像 (通常很小)
            if (img.width < 150) return;

            const rect = img.getBoundingClientRect();
            // 检查图片是否在视口内
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                // 简单的中心距离判断
                const imgCenterX = rect.left + rect.width / 2;
                const imgCenterY = rect.top + rect.height / 2;
                const dist = Math.abs(imgCenterX - startX) + Math.abs(imgCenterY - startY);
                
                if (dist < minDist) {
                    minDist = dist;
                    bestImg = img;
                }
            }
        });

        if (bestImg) {
            // 提取高清图
            if (bestImg.srcset) {
                 let sources = bestImg.srcset.split(',');
                 let lastSource = sources[sources.length - 1].trim();
                 return lastSource.split(' ')[0];
            }
            return bestImg.src;
        }
        return null;
    }

    function triggerFocusMode(url) {
        console.log("触发 Focus Mode: " + url);
        // 震动反馈 (iOS Safari 支持 navigator.vibrate 的话，否则忽略)
        if (navigator.vibrate) navigator.vibrate(50);

        focusImg.src = url;
        overlay.classList.add('active');
    }

})();
</script>
`;

if (body && body.indexOf('</body>') !== -1) {
    body = body.replace('</body>', scriptContent + '</body>');
}

$done({ body });
