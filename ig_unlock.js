
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

# IG 终极存图 (Rule 2: 注入)
^https?:\/\/www\.instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js
    
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com
/**
 * Instagram Ultimate Saver (CSP Strip + Button Inject)
 * 
 * 逻辑二合一：
 * 1. 如果是 Header 阶段：移除安全锁 (Content-Security-Policy)。
 * 2. 如果是 Body 阶段：注入悬浮按钮和交互逻辑。
 */

// --- 阶段 A: 处理响应头 (解锁 CSP) ---
if (typeof $response !== 'undefined' && $response.headers) {
    var headers = $response.headers;
    
    // 暴力移除所有可能阻止脚本运行的安全策略
    var bannedKeys = [
        'Content-Security-Policy', 'content-security-policy',
        'X-WebKit-CSP', 'x-webkit-csp'
    ];
    
    for (var i = 0; i < bannedKeys.length; i++) {
        if (headers[bannedKeys[i]]) delete headers[bannedKeys[i]];
    }
    
    // 必须返回修改后的 headers
    $done({ headers: headers });
} 

// --- 阶段 B: 处理响应体 (注入按钮) ---
else if (typeof $response !== 'undefined' && $response.body) {
    var body = $response.body;
    
    // 这是一个自执行的注入脚本，包含 CSS 和 JS
    var injectCode = `
    <script>
    (function() {
        console.log(">>> IG Ultimate Saver Loaded");

        // 1. 定义强力样式
        var style = document.createElement('style');
        style.innerHTML = \`
            /* 按钮样式 */
            #ig-save-toggle {
                position: fixed;
                bottom: 100px; 
                right: 20px;
                width: 56px;
                height: 56px;
                background: #ff3b30; /* 默认红色 OFF */
                color: white;
                border-radius: 50%;
                border: 3px solid #fff;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                z-index: 2147483647 !important; /* 最高层级 */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-size: 10px;
                font-weight: 800;
                cursor: pointer;
                -webkit-user-select: none;
                transition: transform 0.2s;
            }
            #ig-save-toggle:active { transform: scale(0.9); }
            #ig-save-toggle.active { background: #34c759; /* 激活绿色 ON */ }

            /* 存图模式样式 */
            html[data-ig-save="on"] body * {
                pointer-events: none !important; /* 冻结所有层 */
                -webkit-touch-callout: none !important;
            }
            /* 唯独允许图片响应长按 */
            html[data-ig-save="on"] article img {
                pointer-events: auto !important;
                -webkit-touch-callout: default !important;
                -webkit-user-select: auto !important;
                z-index: 2147483646 !important;
                position: relative !important;
                border: 4px solid #34c759 !important; /* 绿色边框提示 */
                filter: brightness(1.1);
            }
        \`;
        document.head.appendChild(style);

        // 2. 创建按钮逻辑
        function mountButton() {
            if (document.getElementById('ig-save-toggle')) return;

            var btn = document.createElement('div');
            btn.id = 'ig-save-toggle';
            btn.innerHTML = '<span>存图</span><span>OFF</span>';
            
            btn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                var html = document.documentElement;
                if (html.getAttribute('data-ig-save') === 'on') {
                    // 关闭
                    html.setAttribute('data-ig-save', 'off');
                    btn.className = '';
                    btn.innerHTML = '<span>存图</span><span>OFF</span>';
                } else {
                    // 开启
                    html.setAttribute('data-ig-save', 'on');
                    btn.className = 'active';
                    btn.innerHTML = '<span>长按</span><span>图片</span>';
                    if(navigator.vibrate) navigator.vibrate(50);
                }
            };

            // 挂载到 html 根节点，防止 Body 刷新丢失
            document.documentElement.appendChild(btn);
        }

        // 3. 启动守护进程 (每秒检查按钮是否还在)
        mountButton();
        setInterval(mountButton, 1500);
    })();
    </script>
    `;

    // 将代码注入到 body 结束标签之前
    if (body.indexOf('</body>') !== -1) {
        $done({ body: body.replace('</body>', injectCode + '</body>') });
    } else {
        $done({ body: body + injectCode });
    }
} else {
    // 如果都不是，原样返回
    $do
