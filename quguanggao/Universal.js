/***********************************************
> 应用名称：墨鱼自用微信小程序去广告脚本 (全功能版)
> 脚本作者：@ddgksf2013 & Gemini
> 功能说明：
> 1. 包含原版通用正则去广告逻辑
> 2. [抽奖助手] 精准去广告 (去除Banner、开屏、推荐)
> 3. [抽奖助手] 伪装解锁 VIP (辅助去广告)
***********************************************/

var url = $request.url;
var body = $response.body;

// =================================================
// 逻辑模块：抽奖助手 (52choujiang.cn)
// =================================================
if (url.indexOf("52choujiang.cn") !== -1) {
    try {
        var obj = JSON.parse(body);
        
        // 场景1：活动/任务详情页 (去推荐广告)
        if (url.indexOf("/user/view") !== -1 && obj.data) {
            obj。data。show_ad = false;       // 关广告开关
            obj.data.recommend = {};        // 清空推荐位
        }
        
        // 场景2：用户信息页 (伪装 VIP)
        if (url.indexOf("/user/info") !== -1 && obj.data) {
            obj.data.is_vip = 1;
            obj.data.vip_expired = 4092599349;
            obj.data.expire_days = 9999;
            obj.data.vip_deadline = "2099-12-31";
            obj。data.is_live_vip = 1;
            obj.data.live_vip_expired = 4092599349;
            obj.data.live_vip_deadline = "2099-12-31";
        }
        
        // 场景3：创建页 (去 Banner 广告) - 【新发现!】
        if (url.indexOf("/create/setting") !== -1 && obj.data) {
            if (obj.data.banner) {
                obj.data.banner = {}; // 直接把banner广告清空
            }
        }

        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("抽奖助手数据处理异常: " + e);
        $done({});
    }
} 

// =================================================
// 逻辑模块：原版通用去广告 (正则替换)
// =================================================
else {
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
