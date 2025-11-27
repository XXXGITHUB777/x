
[rewrite_local]
^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/([\w-]+) url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/ig_web_parser.js


/**
 * Instagram Mobile Web Parser for Quantumult X
 * 参考油猴脚本逻辑，自动转换 Shortcode 为 MediaID 并调用内部 API
 */
const url = $request.url;
const headers = $request.headers;

// 1. 定义转换算法 (参考油猴脚本逻辑)
// Instagram 的 Shortcode (如 C1xyz...) 转数字 Media ID 的映射表
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function shortcodeToMediaId(shortcode) {
    let id = 0n; // 使用 BigInt 防止溢出
    for (let i = 0; i < shortcode.length; i++) {
        let char = shortcode[i];
        id = id * 64n + BigInt(alphabet.indexOf(char));
    }
    return id.toString();
}

// 2. 从当前 URL 提取 Shortcode
// 匹配 /p/xxx, /reel/xxx, /tv/xxx
const pattern = /\/(p|reel|tv)\/([\w-]+)/;
const match = url.match(pattern);

if (match && match[2]) {
    const shortcode = match[2];
    const mediaId = shortcodeToMediaId(shortcode);
    console.log(`[IG Parser] Shortcode: ${shortcode} -> MediaID: ${mediaId}`);

    // 3. 构造内部 API 请求
    // 参考油猴脚本中的 API: https://i.instagram.com/api/v1/media/{mediaId}/info/
    const apiUrl = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;

    // 关键点：必须复用 Safari 发出的请求头，特别是 Cookie 和 User-Agent
    // 否则 Instagram 会拒绝 API 请求
    const apiHeaders = {
        'User-Agent': headers['User-Agent'] || headers['user-agent'],
        'Cookie': headers['Cookie'] || headers['cookie'],
        'X-IG-App-ID': '936619743392459', // 这里的 App ID 可以写死 web 版通用的，或者尝试从 header 抓取
        'Accept': '*/*'
    };

    const request = {
        url: apiUrl,
        headers: apiHeaders
    };

    // 4. 发起后台请求获取高清数据
    $task.fetch(request).then(response => {
        try {
            const body = JSON.parse(response.body);
            if (body && body.items && body.items.length > 0) {
                const item = body.items[0];
                handleMediaItem(item);
            } else {
                console.log("[IG Parser] API 返回数据为空或格式错误");
                // 失败时不打扰用户，或者可以选择 notify 报错
                $done({});
            }
        } catch (e) {
            console.log(`[IG Parser] JSON 解析失败: ${e}`);
            $done({});
        }
    }, reason => {
        console.log(`[IG Parser] API 请求失败: ${reason.error}`);
        $done({});
    });

} else {
    $done({});
}

// 5. 处理媒体数据并发送通知
function handleMediaItem(item) {
    let downloadUrl = "";
    let type = "";
    let extraInfo = "";

    // 优先检查是否是多图/轮播 (Carousel)
    if (item.carousel_media && item.carousel_media.length > 0) {
        type = "📚 组图/视频";
        // 获取第一张/第一个视频作为预览链接
        // 完整链接列表会打印在日志里
        downloadUrl = getBestUrl(item.carousel_media[0]);
        
        // 将所有链接打印到 QX 日志，方便需要的人去日志里找
        let allLinks = item.carousel_media.map((m, i) => `P${i+1}: ${getBestUrl(m)}`).join("\n");
        console.log(`[IG Parser] 组图链接:\n${allLinks}`);
        extraInfo = `共 ${item.carousel_media.length} 个媒体 (查看日志获取全部)`;
    } 
    // 检查是否是视频
    else if (item.video_versions && item.video_versions.length > 0) {
        type = "🎥 视频";
        downloadUrl = item.video_versions[0].url; // 0 index 通常是最高清
    } 
    // 单图
    else if (item.image_versions2) {
        type = "📸 图片";
        downloadUrl = item.image_versions2.candidates[0].url;
    }

    if (downloadUrl) {
        // 发送通知
        // 这里的 url 字段可以让用户长按通知跳转或复制
        $notify(
            `Instagram 抓取成功 [${type}]`, 
            extraInfo, 
            "长按/下拉 复制链接", 
            { 
                "open-url": downloadUrl, 
                "media-url": downloadUrl // iOS 15+ 可能支持预览
            }
        );
    }
    
    $done({});
}

// 辅助函数：获取单个对象的最佳链接（优先视频，其次图片）
function getBestUrl(mediaObj) {
    if (mediaObj.video_versions && mediaObj.video_versions.length > 0) {
        return mediaObj.video_versions[0].url;
    }
    if (mediaObj.image_versions2 && mediaObj.image_versions2.candidates) {
        return mediaObj.image_versions2.candidates[0].url;
    }
    return "";
}
