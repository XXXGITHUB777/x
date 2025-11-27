/**

 */
[rewrite_local]
# Instagram 网页版：强制开启长按保存 (解锁右键/长按限制)
^https?:\/\/(www\.)?instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * Instagram Floating Downloader for Quantumult X
 * 
 * 放弃与 IG 的触摸事件对抗。
 * 直接添加一个悬浮按钮，点击后提取当前页面所有图片，
 * 在纯净弹窗中展示，供用户原生长按保存。
 */

var body = $response.body;

var scriptContent = `
<script>
(function() {
    // 1. 为了确认脚本是否注入成功，先在控制台打个标
    console.log("🚀 IG Floating Downloader Loaded");

    // --- 样式定义 ---
    const css = \`
        /* 悬浮按钮样式 */
        #qx-ig-fab {
            position: fixed;
            bottom: 120px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: #0095f6; /* IG 蓝 */
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999999;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: transform 0.1s;
            -webkit-user-select: none;
        }
        #qx-ig-fab:active { transform: scale(0.9); }
        #qx-ig-fab svg { width: 24px; height: 24px; fill: white; }

        /* 弹窗容器样式 */
        #qx-ig-modal {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85);
            z-index: 99999999;
            display: none;
            flex-direction: column;
            backdrop-filter: blur(10px);
        }
        #qx-ig-modal.show { display: flex; }
        
        /* 顶部标题栏 */
        .qx-modal-header {
            height: 60px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 20px;
            background: rgba(255,255,255,0.1);
        }
        .qx-modal-title { color: white; font-weight: bold; font-size: 16px; }
        .qx-modal-close { 
            color: white; font-size: 28px; padding: 10px; cursor: pointer; 
        }

        /* 图片列表区域 */
        #qx-ig-list {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            align-items: center;
        }
        
        /* 提取出的图片样式 */
        .qx-extracted-img {
            max-width: 100%;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            /* 关键：强制允许长按 */
            -webkit-touch-callout: default !important;
            user-select: auto !important;
            pointer-events: auto !important;
        }
        .qx-img-wrapper {
            position: relative;
            width: 100%;
            text-align: center;
        }
        .qx-tip {
            color: #aaa;
            font-size: 12px;
            margin-top: 5px;
            margin-bottom: 15px;
        }
    \`;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);

    // --- 创建 UI ---
    
    // 1. 悬浮按钮
    const fab = document.createElement('div');
    fab.id = 'qx-ig-fab';
    // 一个简单的下载图标
    fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
    document.body.appendChild(fab);

    // 2. 弹窗
    const modal = document.createElement('div');
    modal.id = 'qx-ig-modal';
    modal.innerHTML = \`
        <div class="qx-modal-header">
            <span class="qx-modal-title">长按图片保存</span>
            <span class="qx-modal-close">×</span>
        </div>
        <div id="qx-ig-list"></div>
    \`;
    document.body.appendChild(modal);

    // --- 交互逻辑 ---

    const list = document.getElementById('qx-ig-list');
    const closeBtn = modal.querySelector('.qx-modal-close');

    // 点击悬浮球 -> 提取图片
    fab.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止误触 IG 界面
        e.preventDefault();

        list.innerHTML = ''; // 清空旧的
        
        // 核心提取逻辑：找所有 article 里的图片
        const imgs = document.querySelectorAll('article img');
        const foundUrls = new Set();
        let count = 0;

        imgs.forEach(img => {
            // 过滤掉头像 (通常小于 100px)
            if (img.clientWidth < 100) return;

            // 获取高清地址
            let src = img.src;
            if (img.srcset) {
                let sources = img.srcset.split(',');
                let lastSource = sources[sources.length - 1].trim();
                src = lastSource.split(' ')[0];
            }

            // 去重
            if (foundUrls.has(src)) return;
            foundUrls.add(src);

            // 创建展示元素
            const wrapper = document.createElement('div');
            wrapper.className = 'qx-img-wrapper';
            
            const newImg = document.createElement('img');
            newImg.src = src;
            newImg.className = 'qx-extracted-img';
            
            const tip = document.createElement('div');
            tip.className = 'qx-tip';
            tip.innerText = '长按上面图片保存';

            wrapper.appendChild(newImg);
            wrapper.appendChild(tip);
            list.appendChild(wrapper);
            count++;
        });

        if (count === 0) {
            alert("未检测到大图，请先点开某个帖子");
        } else {
            modal.classList.add('show');
        }
    });

    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    // 点击背景也可以关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target === list) {
            modal.classList.remove('show');
        }
    });

})();
</script>
`;

if (body && body.indexOf('</body>') !== -1) {
    body = body.replace('</body>', scriptContent + '</body>');
}

$done({ body });

