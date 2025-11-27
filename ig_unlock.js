/**
 * Instagram Unlock Long-Press for Quantumult X
 * 注入代码到网页，移除遮罩，允许原生 Safari 长按保存
 */
[rewrite_local]
# Instagram 网页版：强制开启长按保存 (解锁右键/长按限制)
^https?:\/\/(www\.)?instagram\.com\/.* url script-response-body https://raw.githubusercontent.com/你的用户名/你的仓库/main/ig_unlock.js

let body = $response.body;

// 定义我们要注入的“解锁代码”
// 包含 CSS 样式强制开启长按菜单
// 包含 JS 定时器移除图片上的遮罩层
const injectCode = `
<script>
(function() {
    // 1. 注入 CSS：强制开启 iOS 长按菜单，并让图片处于最高层级
    const style = document.createElement('style');
    style.innerHTML = \`
        /* 强制开启长按菜单 */
        * { 
            -webkit-touch-callout: default !important; 
            -webkit-user-select: auto !important; 
            user-select: auto !important; 
        }
        /* 确保图片和视频可以被点击 */
        img, video { 
            pointer-events: auto !important; 
            z-index: 999 !important; 
            position: relative !important; 
        }
        /* 隐藏已知的遮罩层 class (IG 经常变，这里只是辅助) */
        ._aagw { pointer-events: none !important; }
    \`;
    document.head.appendChild(style);

    // 2. 强力模式：JS 循环检测
    // 因为 IG 是动态加载，所以需要每隔一小段时间清理一次遮罩
    setInterval(() => {
        // 策略 A: 找到所有图片，尝试让它们“浮”上来
        let imgs = document.querySelectorAll('img');
        imgs.forEach(img => {
            img.style.pointerEvents = 'auto';
            // 找到图片的父级遮罩，把它们设为“可穿透”
            // IG 的结构通常是 div > div > img，父级 div 挡住了点击
            if(img.parentElement && img.parentElement.tagName === 'DIV') {
                img.parentElement.style.pointerEvents = 'none';
            }
            if(img.parentElement && img.parentElement.parentElement && img.parentElement.parentElement.tagName === 'DIV') {
                img.parentElement.parentElement.style.pointerEvents = 'none';
            }
        });

        // 策略 B: 针对视频，尝试显示原生控件 (效果不一定完美，因为 IG 视频通常分段)
        let videos = document.querySelectorAll('video');
        videos.forEach(vid => {
            vid.style.pointerEvents = 'auto';
            // 如果你想看进度条，可以取消下面这行的注释，但可能会破坏 IG 界面
            // vid.setAttribute('controls', 'true'); 
        });
    }, 800); // 每 0.8 秒执行一次清理
})();
</script>
`;

// 将我们的代码注入到 </body> 标签之前
// 这样代码就会随着网页一起加载并运行
if (body.indexOf('</body>') !== -1) {
    body = body.replace('</body>', injectCode + '</body>');
}

$done({ body });
