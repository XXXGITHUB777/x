
[rewrite_local]
# IG 终极存图 (Rule 1: 拆锁)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js

  
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com

/**
 * IG Safe Save Mode (Final Fix)
 * 
 * 修复逻辑：
 * 1. 增加 Content-Type 过滤，只修改 HTML，防止破坏 AJAX/JSON 导致白屏。
 * 2. 移除 CSP 安全锁，允许脚本运行。
 * 3. 注入“存图模式”开关。
 */

const isHeader = typeof $response !== 'undefined' && $response.headers;
const isBody = typeof $response !== 'undefined' && $response.body;

// --- 阶段 1: 修改响应头 (拆除 CSP) ---
if (isHeader) {
    var headers = $response.headers;
    // 移除 CSP 限制
    var banned = ['Content-Security-Policy', 'content-security-policy', 'X-WebKit-CSP'];
    for (var key of banned) {
        if (headers[key]) delete headers[key];
    }
    $done({ headers: headers });
}

// --- 阶段 2: 修改响应体 (注入按钮) ---
else if (isBody) {
    var headers = $response.headers || {};
    var cType = headers['Content-Type'] || headers['content-type'] || '';
    
    // 【关键修复】如果不是网页 HTML，直接放行，绝对不修改！
    if (cType.indexOf('text/html') === -1) {
        $done({});
    } else {
        // 是网页，开始注入
        var body = $response.body;
        var injectCode = `
        <script>
        (function() {
            // 样式定义
            var style = document.createElement('style');
            style.innerHTML = \`
                #ig-safe-switch {
                    position: fixed;
                    bottom: 15%;
                    right: 10px;
                    width: 50px;
                    height: 50px;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    border: 2px solid rgba(255,255,255,0.5);
                    border-radius: 50%;
                    z-index: 2147483647;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 12px;
                    backdrop-filter: blur(5px);
                    cursor: pointer;
                    -webkit-user-select: none;
                }
                /* 开启模式后的核心逻辑 */
                html.ig-saving body * {
                    pointer-events: none !important; /* 冻结所有元素 */
                    -webkit-touch-callout: none !important;
                }
                /* 唯独解冻图片 */
                html.ig-saving article img {
                    pointer-events: auto !important;
                    -webkit-touch-callout: default !important; /* 恢复长按菜单 */
                    -webkit-user-select: auto !important;
                    position: relative !important;
                    z-index: 2147483646 !important;
                    border: 3px solid #00ff00 !important; /* 绿色边框指示 */
                }
            \`;
            document.head.appendChild(style);

            // 创建按钮
            var btn = document.createElement('div');
            btn.id = 'ig-safe-switch';
            btn.innerHTML = '存图<br>OFF';
            
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                var html = document.documentElement;
                
                if (html.classList.contains('ig-saving')) {
                    html.classList.remove('ig-saving');
                    btn.innerHTML = '存图<br>OFF';
                    btn.style.background = 'rgba(0,0,0,0.7)';
                } else {
                    html.classList.add('ig-saving');
                    btn.innerHTML = '长按<br>ON';
                    btn.style.background = '#28a745'; // 绿色
                    alert('存图模式已开启！\\n页面已冻结，请直接长按带绿框的图片。\\n存完记得关闭。');
                }
            });

            // 挂载到 HTML 根节点，防刷新丢失
            document.documentElement.appendChild(btn);
        })();
        </script>
        `;
        
        // 插入代码
        if (body.indexOf('</body>') !== -1) {
            body = body.replace('</body>', injectCode + '</body>');
        } else {
            body = body + injectCode;
        }
        $done({ body: body });
    }
} else {
    $done({});
}
