/***********************************************
> 应用名称：墨鱼自用微信小程序去广告脚本 (融合版)
> 功能说明：
> 1. 包含原版通用正则去广告逻辑
> 2. 新增 [抽奖助手] 小程序精准去广告 (去除Banner和推荐)
***********************************************/

var url = $request.url;
var body = $response.body;

// -------------------------------------------------
// 逻辑一：抽奖助手 (精准 JSON 处理)
// -------------------------------------------------
if (url.indexOf("52choujiang.cn") !== -1) {
    try {
        var obj = JSON.parse(body);
        if (obj.data) {
            // 强制关闭广告开关
            obj.data.show_ad = false;
            // 清空 Banner 推荐位
            obj.data.recommend = {};
            // 清空活动配置中的潜在广告
            if(obj.data.activity_info_config) {
                 // 按需清理，防止误伤不做过多处理
            }
        }
        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("抽奖助手JSON解析失败，跳过处理");
        $done({});
    }
} 

// -------------------------------------------------
// 逻辑二：原版通用逻辑 (正则替换)
// -------------------------------------------------
else {
    // 原版核心正则逻辑
    re('"excitationAd":"\\d"@Ad":"\\d"@ad":true@AdId":"[^"]*"@adid":"[^"]*"@fr_videp_if":"1@adunit[^"]*"', '"excitationAd":"0"@Ad":"0"@ad":false@AdId":""@adid":""@fr_videp_if":"0@"');

    function re() {
        if (arguments[0].includes("@")) {
            var r = arguments[0].split("@"),
                l = arguments[1].split("@");
            for (i = 0; i < r.length; i++) {
                var a = RegExp(r[i], "g");
                body = body.replace(a, l[i]);
            }
        } else {
            var a = RegExp(arguments[0], "g");
            body = body.replace(a, arguments[1]);
        }
        $done({body: body});
    }
}
