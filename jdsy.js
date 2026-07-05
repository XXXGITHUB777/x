/**
 * @fileoverview 京东评价官试用商品 - 定时监控上新 (Quantumult X)
 * @description 结合 Rewrite 和 Task。手动访问页面获取参数后，定时每半小时监控库存。
 */

const isRequest = typeof $request !== "undefined";

if (isRequest) {
    // ---------------------------------
    // 1. Rewrite 阶段：拦截请求并保存参数
    // ---------------------------------
    const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
    const body = $request.body;
    
    if (cookie && body) {
        $prefs.setValueForKey(cookie, "JD_CommentOfficer_Cookie");
        $prefs.setValueForKey(body, "JD_CommentOfficer_Body");
        $notify("🐶 京东评价官", "✅ 参数获取成功", "已保存最新请求参数，定时监控任务已准备就绪！");
    } else {
        console.log("[京东评价官] 无法提取 Cookie 或 Body，请检查请求。");
    }
    // 放行原请求
    $done({});

} else {
    // ---------------------------------
    // 2. Cron Task 阶段：定时发起监控请求
    // ---------------------------------
    const cookie = $prefs.valueForKey("JD_CommentOfficer_Cookie");
    const body = $prefs.valueForKey("JD_CommentOfficer_Body");

    if (!cookie || !body) {
        $notify("🐶 京东评价官", "❌ 缺少参数", "请先在京东APP内手动进入一次“评价官免费试用”页面获取参数。");
        $done();
    }

    const req = {
        url: "https://api.m.jd.com/client.action?functionId=getCommentOfficerTrialHome",
        method: "POST",
        headers: {
            "Cookie": cookie,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "jdapp;iPhone;15.8.50;;;M/5.0;appBuild/170577;jdSupportDarkMode/0;lang/zh_CN",
            "Origin": "https://comment.m.jd.com",
            "Referer": "https://comment.m.jd.com/"
        },
        body: body
    };

    $task.fetch(req).then(response => {
        try {
            let obj = JSON.parse(response.body);
            
            // 验证接口是否正常返回商品数据
            if (obj && obj.result && obj.result.trialActivities) {
                let items = obj.result.trialActivities;
                
                // 筛选出剩余件数 > 0 或者状态不等于 31（31通常代表已结束/抢光）的商品
                let availableItems = items.filter(item => item.claimableNum > 0 || item.totalNum > 0);
                
                if (availableItems.length > 0) {
                    // 有库存，格式化文本并弹窗
                    let msgList = availableItems.map(i => {
                        let shortTitle = i.skuTitle.length > 15 ? i.skuTitle.substring(0, 15) + "..." : i.skuTitle;
                        return `📦 ${shortTitle} (剩余:${i.claimableNum}件)`;
                    });
                    
                    $notify(
                        "🐶 京东评价官上新啦！", 
                        `发现 ${availableItems.length} 个可领商品，快去APP查看`, 
                        msgList.join("\n")
                    );
                    console.log(`[京东评价官监控] 发现新商品！\n${msgList.join("\n")}`);
                } else {
                    // 没库存，静默处理（只在日志打印，不打扰用户）
                    console.log("[京东评价官监控] 暂无可用商品，全被抢光。");
                }
            } else {
                console.log("[京东评价官监控] 数据解析失败，可能是请求体中的防伪签名(h5st)已过期。响应内容: " + response.body);
            }
        } catch (e) {
            console.log("[京东评价官监控] 脚本报错: " + e.message);
        }
        $done();
    }, error => {
        console.log("[京东评价官监控] 网络请求失败: " + error);
        $done();
    });
}
