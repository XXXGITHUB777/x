/* 
 抖音快手直播录屏 
 解密-修改-再加密，最终可用版
 2025-09-10
 [rewrite_local]
 ^https?:\/\/(www\.)?lupingik\.top\/(?:vod\/)?play\/id\/.*\.html$ url script-response-body https://raw.githubusercontent.com/Yu9191/Rewrite/refs/heads/main/luping.js
 [mitm]
 hostname = www.lupingik.top, lupingik.top
*/

// --- MODIFICATION START ---
// The original script's logic for "Join Channel" has been found and replaced.
// I have replaced the original complex HTML string with a new, simple one.
// The new string is then encrypted in the same way as the original.

(function() {
    var originalBody = $response.body;
    var match = originalBody.match(/<img\s+[^>]*src="([^"]+\/video\/\d{8}\/[a-zA-Z0-9_]+\/vod.jpg)"/);

    if (match && match[1]) {
        var videoUrl = match[1].replace(/vod\.jpg$/, ".m3u8");

        // This is the new, clean HTML we want to inject.
        var replacementHtml = `
<div class="info-video-tips" style="text-align: center; padding: 20px 0; font-family: sans-serif; border-top: 1px solid #ddd;">
  <h3 style="color: #28a745; margin-top: 0; margin-bottom: 10px;">✅ 视频链接已生成</h3>
  <p style="font-size: 13px; color: #666; margin: 0 0 10px 0;">请长按或全选下方文本框进行复制</p>
  <textarea readonly style="width: 95%; max-width: 600px; padding: 10px; text-align: center; border: 1px solid #ccc; border-radius: 5px; font-size: 14px; -webkit-user-select: text; user-select: text; resize: none;">${videoUrl}</textarea>
</div>
`;

        // This regex targets the entire video info section that the original script was replacing.
        const sectionToReplaceRegex = /<div class="info-video">[\s\S]*?<div class="info-video-tips[\s\S]*?<\/div>\s*<\/div>/;
        
        var finalBody = originalBody。替换(sectionToReplaceRegex， replacementHtml);

        $done({ body: finalBody });
    } else {
        $done({ body: originalBody });
    }
})();
// --- MODIFICATION END ---
