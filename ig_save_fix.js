[rewrite_local]
# 步骤1: 拆除安全锁 (必须用 script-response-header)
^https?:\/\/www\.instagram\.com\/.* url script-response-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_save_fix.js
[mitm]
hostname = www.instagram.com, instagram.com



/**
 * Instagram Native Save (QX Ultimate Fix)
 */

if (typeof $response !== 'undefined') {

    // --- 阶段 A: Header 处理 ---
    if ($response.headers && !$response.body) {
        var headers = $response.headers;
        var bannedKeys = [
            'Content-Security-Policy',
            'content-security-policy',
            'X-WebKit-CSP',
            'x-webkit-csp',
            'Strict-Transport-Security'
        ];

        bannedKeys.forEach(key => {
            if (headers[key]) delete headers[key];
        });

        $done({ headers: headers });
    }

    // --- 阶段 B: Body 处理 ---
    else if ($response.body) {
        var headers = $response.headers || {};
        var cType = headers['Content-Type'] || headers['content-type'] || '';
        
        if (cType.indexOf('text/html') === -1) {
            $done({});
        } else {
            var body = $response.body;

            var injectCode = `
            <script>
            (function() {
                'use strict';
                console.log('>>> IG Save Script Loaded');

                // --- 样式注入 ---
                var style = document.createElement('style');
                style.id = 'qx-ig-style';
                style.innerHTML = \`
                    html.qx-save-on body * {
                        pointer-events: none !important;
                        -webkit-touch-callout: none !important;
                    }
                    html.qx-save-on article img {
                        pointer-events: auto !important;
                        z-index: 2147483646 !important;
                        position: relative !important;
                        -webkit-touch-callout: default !important;
                        -webkit-user-select: auto !important;
                        border: 3px solid #34c759 !important;
                        filter: brightness(1.05);
                    }
                    #qx-ig-toggle {
                        position: fixed;
                        bottom: 120px;
                        right: 20px;
                        width: 50px;
                        height: 50px;
                        background: rgba(0,0,0,0.6);
                        border: 2px solid rgba(255,255,255,0.5);
                        border-radius: 50%;
                        color: white;
                        font-size: 12px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 2147483647;
                        backdrop-filter: blur(4px);
                        cursor: pointer;
                        user-select: none;
                    }
                    #qx-ig-toggle.active {
                        background: #34c759;
                        border-color: white;
                    }
                \`;
                document.head.appendChild(style);

                // --- 创建按钮 ---
                function createBtn() {
                    if (document.getElementById('qx-ig-toggle')) return;
                    var btn = document.createElement('div');
                    btn.id = 'qx-ig-toggle';
                    btn.innerHTML = 'OFF';
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation(); e.preventDefault();
                        var html = document.documentElement;
                        if(html.classList.contains('qx-save-on')){
                            html.classList.remove('qx-save-on');
                            btn.classList.remove('active');
                            btn.innerHTML = 'OFF';
                        } else {
                            html.classList.add('qx-save-on');
                            btn.classList.add('active');
                            btn.innerHTML = 'ON';
                            if(navigator.vibrate) navigator.vibrate(50);
                        }
                    });
                    document.documentElement.appendChild(btn);
                }

                // 延迟挂载
                setTimeout(createBtn, 500);

                // --- MutationObserver 守护 ---
                var observer = new MutationObserver(function(mutations) {
                    if (!document.getElementById('qx-ig-toggle')) createBtn();
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
            })();
            </script>
            `;

            if (body.indexOf('</body>') !== -1) {
                body = body.replace('</body>', injectCode + '</body>');
            } else {
                body += injectCode;
            }

            $done({ body: body });
        }
    } else {
        $done({});
    }
} else {
    $done({});
}
