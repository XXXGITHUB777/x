/*
京东试用监控 - 终极诊断版
先验证基础机制是否正常
*/

console.log("JD脚本已加载");

// ========== MITM 模式 ==========
if (typeof $request !== 'undefined' && typeof $response !== 'undefined') {
    console.log("→ 进入 MITM 模式");
    
    var url = $request.url || "无URL";
    var body = $request.body || "";
    
    // 不管什么 URL 都存
    var item = {
        url: url,
        bodyLen: body.length,
        time: new Date().toLocaleTimeString()
    };
    
    try {
        $persistentStore.write(JSON.stringify(item), "jd_mitm_cache");
        console.log("→ 缓存写入成功");
    } catch(e) {
        console.log("→ 缓存写入失败: " + e);
    }
    
    // 立刻通知用户
    $notify("【MITM触发】", url, "长度=" + body.length);
    
    $done({});
    return;
}

// ========== cron 模式 ==========
console.log("→ 进入 cron 模式");

var raw = $persistentStore.read("jd_mitm_cache");
if (raw) {
    console.log("→ 读取缓存成功: " + raw);
    $notify("【Cron运行】", "有缓存", raw);
} else {
    console.log("→ 读取缓存失败/为空");
    $notify("【Cron运行】", "无缓存", "请先打开京东App进入试用列表");
}

$done({});
