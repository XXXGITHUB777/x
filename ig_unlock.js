/**

 */
[rewrite_local]
# Instagram 网页版：强制开启长按保存 (解锁右键/长按限制)
^https?:\/\/(www\.)?instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_unlock.js
[mitm]
# 必须包含这两条，对应网页版的主域名
hostname = www.instagram.com, instagram.com
/**
 * Instagram Root-Level Save Button
 * 
 * 策略：将按钮挂载到 documentElement (html标签) 而非 body。
 * 避开 React 的 DOM Diff 刷新机制，确保按钮永久驻留。
 */

var body = $response.body;

// 我们把代码注入到 <head> 结束之前，确保尽早加载 CSS
// 把 JS 放在页面底部执行
var styleBlock = `
<style>
    /* 1. 定义存图模式的样式 */
    /* 当 html 标签上有 data-save-mode="on" 时生效 */
    html[data-save-mode="on"] body * {
        pointer-events: none !important;
        -webkit-touch-callout: none !important;
    }
    
    /* 图片除外：允许点击、允许选中、允许长按 */
    html[data-save-mode="on"] article img {
        pointer-events: auto !important;
        -webkit-user-select: auto !important;
        -webkit-touch-callout: default !important;
        position: relative !important;
        z-index: 999999 !important;
        border: 3px solid #00ff00 !important; /* 醒目的绿色边框 */
        box-sizing: border-box !important;
    }

    /* 2. 按钮样式 */
    #ig-root-btn {
        position: fixed;
        bottom: 15%; /* 放在右下侧，避开底部导航栏 */
        right: 10px;
        width: 60px;
        height: 60px;
        background: #ff3b30; /* 初始红色 (OFF) */
        color: white;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        z-index: 2147483647 !important; /* CSS 允许的最大整数，确保在最顶层 */
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
        cursor: pointer;
        -webkit-user-select: none;
        transition: transform 0.2s, background 0.2s;
    }
    
    #ig-root-btn:active {
        transform: scale(0.9);
    }

    #ig-root-btn.active {
        background: #34c759; /* 激活变绿 (ON) */
    }
</style>
`;

var scriptBlock = `
<script>
(function() {
    console.log(">>> IG Script Starting...");

    // 1. 创建按钮函数
    function createButton() {
        // 防止重复创建
        if (document.getElementById('ig-root-btn')) return;

        var btn = document.createElement('div');
        btn.id = 'ig-root-btn';
        btn.innerHTML = '存图<br>OFF';
        
        // 2. 绑定点击事件
        btn.onclick = function(e) {
            // 阻止冒泡，防止触发网页其他事件
            e.stopPropagation();
            e.preventDefault();

            var html = document.documentElement;
            var isModeOn = html.getAttribute('data-save-mode') === 'on';

            if (isModeOn) {
                // 关闭模式
                html.setAttribute('data-save-mode', 'off');
                btn.innerHTML = '存图<br>OFF';
                btn.className = '';
            } else {
                // 开启模式
                html.setAttribute('data-save-mode', 'on');
                btn.innerHTML = '存图<br>ON';
                btn.className = 'active';
                // 震动反馈
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
            }
        };

        // 3. 关键步骤：挂载到 html 根节点，而不是 body
        // 这样 React 刷新 body 时，我们的按钮不会消失
        document.documentElement.appendChild(btn);
        console.log(">>> Button Appended to Root");
    }

    // 4. 定时检查：虽然挂在 root 上很稳，但为了保险，每秒检查一次按钮还在不在
    setInterval(createButton, 1000);
    
    // 立即执行一次
    setTimeout(createButton, 500);
})();
</script>
`;

// 注入逻辑：CSS 放入 Head，JS 放入 Body 底部
if (body) {
    // 插入样式
    if (body.indexOf('</head>') !== -1) {
        body = body.replace('</head>', styleBlock + '</head>');
    } else {
        // 如果没找到 head，就插在 body 开始
        body = styleBlock + body;
    }

    // 插入脚本
    if (body.indexOf('</body>') !== -1) {
        body = body.replace('</body>', scriptBlock + '</body>');
    } else {
        // 兜底
        body = body + scriptBlock;
    }
}

$done({ body: body });
