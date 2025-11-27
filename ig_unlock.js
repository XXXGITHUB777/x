
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

  
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * 任务：Instagram 网页版原生画质长按保存 (防白屏/CSP修复版)
 * 核心机制：移除 CSP -> 注入 Toggle 脚本 -> 动态控制图层层级
 */

const isHtml = ($response.headers['Content-Type'] && $response.headers['Content-Type'].indexOf('text/html') !== -1) || 
               ($response.headers['content-type'] && $response.headers['content-type'].indexOf('text/html') !== -1);

// 【关键安全检查】如果不是 HTML (例如 JSON/AJAX)，直接返回，防止白屏！
if (!isHtml) {
    $done({});
} else {
    // 1. 获取原始响应体和头
    let body = $response.body;
    let headers = $response.headers;

    // 2. 移除 CSP (Content-Security-Policy) 以允许注入脚本执行
    // 遍历可能的大小写组合，统统干掉
    const cspKeys = ['Content-Security-Policy', 'content-security-policy', 'X-Frame-Options', 'x-frame-options'];
    for (let key of cspKeys) {
        if (headers[key]) delete headers[key];
    }

    // 3. 注入客户端脚本 (Client-Side Injection)
    // 这段 JS 将在 Safari 浏览器内部运行
    const injectCode = `
    <script>
    (function() {
        console.log('Instagram Native Saver Loaded');

        // 创建浮动开关样式
        const style = document.createElement('style');
        style.innerHTML = \`
            #insta-save-toggle {
                position: fixed;
                bottom: 100px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 50%;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border: 2px solid rgba(255,255,255,0.3);
                transition: all 0.3s;
                user-select: none;
                -webkit-user-select: none;
            }
            #insta-save-toggle.active {
                background: rgba(52, 199, 89, 0.9); /* iOS Green */
                border-color: #fff;
            }
            #insta-save-toggle svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
            /* 开启保存模式后的强制样式 */
            .save-mode-active img {
                pointer-events: auto !important;
                z-index: 9999 !important;
                position: relative !important;
                user-select: auto !important;
                -webkit-user-select: auto !important;
                -webkit-touch-callout: default !important;
            }
            /* 甚至可以尝试把覆盖在上面的 div 穿透 */
            .save-mode-active div[role="button"], 
            .save-mode-active div[class*="Overlay"] {
                pointer-events: none !important;
            }
        \`;
        document.head.appendChild(style);

        // 创建浮动按钮
        const btn = document.createElement('div');
        btn.id = 'insta-save-toggle';
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        document.body.appendChild(btn);

        let isActive = false;

        // 切换模式逻辑
        btn.addEventListener('click', function() {
            isActive = !isActive;
            if (isActive) {
                btn.classList.add('active');
                document.body.classList.add('save-mode-active');
                showToast('长按保存模式：开启');
                forceImages();
            } else {
                btn.classList.remove('active');
                document.body.classList.remove('save-mode-active');
                showToast('浏览模式：恢复');
            }
        });

        // 提示框小工具
        function showToast(msg) {
            let toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;z-index:1000000;pointer-events:none;';
            toast.innerText = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        // 核心逻辑：处理 React 动态加载的图片
        // 使用 MutationObserver 监听 DOM 变化（因为 Insta 是 SPA）
        function forceImages() {
            if (!isActive) return;
            // 查找所有图片，尝试移除 srcset 以确保 Safari 锁定在当前 src，
            // 或者仅仅提升层级。Instagram 的图片通常有复杂的 class。
            // 这里的策略是：暴力提升所有 img 标签
            const imgs = document.querySelectorAll('img');
            imgs.forEach(img => {
                // 排除头像等小图，只处理大图 (假设宽度大于 100)
                if (img.width > 100 || img.naturalWidth > 100) {
                    img.style.pointerEvents = 'auto';
                    img.style.zIndex = '9999';
                }
            });
        }

        // 监听滚动和 DOM 变动，确保新加载的图片也能被处理
        const observer = new MutationObserver((mutations) => {
            if (isActive) {
                forceImages();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

    })();
    </script>
    `;

    // 4. 将脚本插入到 body 结束标签之前
    body = body.replace('</body>', injectCode + '</body>');

    // 5. 返回修改后的 Header 和 Body
    $done({ body: body, headers: headers });
}
