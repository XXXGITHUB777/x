
let body = $response.body;

// 1. 注入 CSS (对应源脚本中的 GM_addStyle)
// 包含: iframe, .result, .dlh, .tocaowrap, #tuzaoblock, .footer.wrap, #control_block, Game Tip 等
const cleanStyle = `
<style>
    iframe,
    .result,
    .dlh,
    .tocaowrap,
    #tuzaoblock,
    .footer.wrap,
    #img_list br,
    #img_list span,
    #control_block,
    img[alt="Game Tip"],
    #bodywrap:has(link[rel="prerender"]) {
        display: none !important;
    }
    
    /* 优化阅读区域显示 (源脚本逻辑) */
    #imgarea { display: block; margin: 0 auto; padding-bottom: 2rem; }
    
    /* 隐藏原版搜索框等干扰元素 */
    .search_person { display: none; }
</style>
`;

// 2. 执行 HTML 文本替换
// 插入样式表到 </head> 之前
body = body.replace('</head>', cleanStyle + '</head>');

// 3. 处理下载按钮防误杀 (对应源脚本中的 重置元素类名 逻辑)
// 源脚本逻辑：if(url.includes('photos-index-')) 重置 #ads -> download_btn
// 为了简单高效，直接在全局做字符串替换，将 ID 为 ads/adsbox 的元素改名，防止被其他去广告规则命中
body = body.replace(/id=["']ads["']/g, 'class="download_btn" id="safe_btn_1"')
           。replace(/id=["']adsbox["']/g, 'class="download_btn" id="safe_btn_2"');

$done({ body });
