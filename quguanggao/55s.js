
[mitm]
hostname = *.qq.com, *.qpic.cn, *.gtimg.cn, servicewechat.com, mp.weixin.qq.com, ad.weixin.qq.com, cube.weixinbridge.com

[rewrite_local]

# 你的通用广告屏蔽脚本（唯一引用入口）
^https?:\/\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/quguanggao/55s.js

/***********************************
 * ScriptName: 微信小程序 5s 开屏广告去除 (Universal)
 * Updated: 2025-11-28
 ***********************************/

const headers = $request.headers;

// 统一拒绝广告域请求（广点通 + 微信 bridge + CDN 素材）
const blockAd = url => {
  const adPatterns = [
    /gdt\.qq\.com/，
    /wxs\.qq\.com\/ad/，
    /cube\.weixinbridge\.com/，
    /ad\.weixin\.qq\.com/，
    /qpic\.cn.*(splash|launch|ad)/，
    /gtimg\.cn.*(splash|launch|ad)/
  ];
  return adPatterns.some(p => p.test(url));
};

if (blockAd($request.url)) {
  $done({ response: { status: 204 } });
}

// 移除响应 CSP/广告锁（如果有）
if (headers["Content-Security-Policy"]) {
  delete headers["Content-Security-Policy"];
}
if (headers["content-security-policy"]) {
  delete headers["content-security-policy"];
}

// 处理响应 body：清除倒计时和广告 JSON 字段
let body = $response.body;
try {
  let json = JSON.parse(body);

  const adFields = [
    "launchAd"，"launch_ad","splash_ad","splashAd",
    "ad"，"ads","ad_list","advert","advertisement",
    "banner"，"banner_ad","pop_ad","popup",
    "timer"，"time","count","countdown","countdown_seconds"
  ];

  for (let key of adFields) {
    if (json[key] !== undefined) {
      json[key] = Array.isArray(json[key]) ? [] : null;
    }
  }

  json.timer = 0;
  json.count = 0;
  json.countdown = 0;
  json.countdown_seconds = 0;
  json.can_skip = true;
  json.skip = true;

  $done({ body: JSON.stringify(json) });
} catch(e) {
  $done({});
}
