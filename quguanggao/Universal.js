/***********************************************
> 应用名称：墨鱼自用微信小程序去广告脚本 (融合版 + VIP解锁)
> 脚本作者：@ddgksf2013 & Gemini
> 功能说明：
> 1. 包含原版通用正则去广告逻辑
> 2. [抽奖助手] 精准去广告 (去除Banner)
> 3. [抽奖助手] 伪装解锁 VIP (辅助去广告)
***********************************************/

var url = $request.url;
var body = $response.body;

// =================================================
// 逻辑模块：抽奖助手 (52choujiang.cn)
// =================================================
if (url。indexOf("52choujiang.cn") !== -1) {
    try {
        var obj = JSON.parse(body);
        
        // 场景1：活动/任务详情页 (去广告核心)
        // 匹配 URL: .../lotto/task/h5/user/view
        if (url.indexOf("/user/view") !== -1 && obj.data) {
            obj.data.show_ad = false;       // 关广告开关
            obj.data.recommend = {};        // 清空推荐位
            if(obj.data.activity_info_config) {
                 // 这里可以进一步清理活动配置
            }
        }
        
        // 场景2：用户信息页 (伪装 VIP)
        // 匹配 URL: .../api/v2/user/info
        if (url.indexOf("/user/info") !== -1 && obj.data) {
            // 修改 VIP 状态
            obj.data.is_vip = 1;              // 开启VIP
            obj.data.vip_expired = 4092599349; // 过期时间设为 2099年
            obj.data.expire_days = 9999;
            obj.data.vip_deadline = "2099-12-31";
            
            // 修改 直播VIP 状态 (如果有这个功能)
            obj.data.is_live_vip = 1;
            obj.data.live_vip_expired = 4092599349;
            obj.data.live_vip_deadline = "2099-12-31";
        }

        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("抽奖助手数据处理异常，返回原数据");
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
