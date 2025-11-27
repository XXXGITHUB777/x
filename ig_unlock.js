/**

 */
[rewrite_local]
# Instagram 网页版：强制开启长按保存 (解锁右键/长按限制)
^https?:\/\/(www\.)?instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com
/**
 * Instagram "Save Mode" for Quantumult X
 * 
 * 原理：
 * 模仿阅读器模式的“独占”逻辑。
 * 当开启“存图模式”时，使用 CSS 强制禁用页面上除 img 以外所有元素的点击事件。
 * 这样手指的长按信号只能被 img 接收，从而 100% 唤起原生菜单。
 */

var body = $response.body;

var scriptContent = `
<script>
(function() {
    // --- 1. 注入强力 CSS ---
    // 这段 CSS 只有在 body 拥有 class="ig-save-mode-on" 时才会生效
    const css = \`
        /* 存图模式开启时的样式 */
        body.ig-save-mode-on * {
            /* 禁用所有元素的触摸交互，防止误触遮罩层 */
            pointer-events: none !important; 
            /* 禁用长按菜单，防止长按空白处弹出菜单 */
            -webkit-touch-callout: none !important;
        }

        /* 唯独让图片保持原生活跃状态 */
        body.ig-save-mode-on article img, 
        body.ig-save-mode-on article video {
            pointer-events: auto !important; /* 允许点击 */
            -webkit-user-select: auto !important; /* 允许选中 */
            -webkit-touch-callout: default !important; /* 允许系统长按菜单 */
            z-index: 999999 !important; /* 确保层级最高 */
            position: relative !important;
            border: 2px solid #00ff00 !important; /* 绿色边框提示哪些图可点 */
        }

        /* 按钮本身的样式 (必须永远可点) */
        #ig-mode-toggle {
            pointer-events: auto !important; 
            position: fixed;
            top: 60px; /* 避开顶部刘海 */
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647 !important;
            padding: 10px 20px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            font-weight: bold;
            border-radius: 30px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.2s;
            -webkit-user-select: none;
        }
        #ig-mode-toggle.active {
            background-color: #00e676; /* 激活变绿 */
            color: black;
        }
    \`;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);

    // --- 2. 创建开关按钮 ---
    const btn = document.createElement('div');
    btn.id = 'ig-mode-toggle';
    btn.innerText = '🔴 存图 OFF';
    
    // 点击事件
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const body = document.body;
        
        if (body.classList.contains('ig-save-mode-on')) {
            // 关闭模式
            body.classList.remove('ig-save-mode-on');
            btn.innerText = '🔴 存图 OFF';
            btn.className = '';
        } else {
            // 开启模式
            body.classList.add('ig-save-mode-on');
            btn.innerText = '🟢 存图 ON (长按图片)';
            btn.className = 'active';
            
            // 尝试震动反馈
            if(navigator.vibrate) navigator.vibrate(50);
        }
    });

    document.body.appendChild(btn);
    
    console.log("IG Save Mode Script Loaded");

})();
</script>
`;

// 注入脚本
if (body && body.indexOf('</body>') !== -1) {
    body = body.replace('</body>', scriptContent + '</body>');
}

$done({ body });

