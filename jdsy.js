/*
京东试用监控 v6 - Quantumult X 版
功能：每30分钟自动检查，有新品上架通知，售光不报

QX 配置：
[rewrite_local]
^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用监控, enable=true

使用方法：
1. 开启 MitM 和重写
2. 打开京东 App → 评价中心 → 试用列表
3. 收到"抓取成功"通知后，脚本开始自动监控
*/

var REQ_KEY = "jd_trial_req";
var SNAP_KEY = "jd_trial_snap";
var FAIL_KEY = "jd_trial_fail";

// ========== 模式判断 ==========
var isMitm = (typeof $request !== 'undefined' && typeof $response !== 'undefined');

if (isMitm && $request.url.indexOf("functionId=getCommentOfficerTrialHome") > -1) {
    runMitm();
} else {
    runCron();
}

// ========== MITM 模式：抓包 ==========
function runMitm() {
    // 存完整请求（给 cron 重放用）
    var req = {
        url: $request.url || "",
        method: "POST",
        headers: $request.headers || {},
        body: $request.body || ""
    };
    $persistentStore.write(JSON.stringify(req), REQ_KEY);
    $persistentStore.write("0", FAIL_KEY);
    
    $notify("京东试用", "抓取成功", "已缓存请求，每30分钟自动检查");
    
    // 解析响应
    try {
        var obj = JSON.parse($response.body);
        if (obj && obj.result) {
            processSnap(obj.result);
        }
    } catch(e) {}
    
    $done({});
}

// ========== cron 模式：定时检查 ==========
function runCron() {
    var reqStr = $persistentStore.read(REQ_KEY);
    if (!reqStr) {
        $notify("京东试用", "未初始化", "请先打开京东App进入试用列表");
        return $done({});
    }
    
    var req;
    try {
        req = JSON.parse(reqStr);
    } catch(e) {
        return $done({});
    }
    
    $task.fetch(req).then(function(resp) {
        try {
            var obj = JSON.parse(resp.body);
            if (obj && obj.result) {
                $persistentStore.write("0", FAIL_KEY);
                processSnap(obj.result);
            } else {
                handleFail();
            }
        } catch(e) {
            handleFail();
        }
    }, function() {
        handleFail();
    });
}

// ========== 核心：处理快照 + 比对 ==========
function processSnap(result) {
    var acts = result.trialActivities || [];
    
    // 只保留有库存的商品（claimableNum > 0）
    var availIds = [];
    var availMap = {};
    
    for (var i = 0; i < acts.length; i++) {
        if (acts[i].claimableNum > 0) {
            var id = acts[i].activityId + "_" + acts[i].skuId;
            availIds.push(id);
            availMap[id] = {
                name: acts[i].skuName || ("SKU:" + acts[i].skuId),
                stock: acts[i].claimableNum
            };
        }
    }
    
    // 售光 → 静默
    if (availIds.length === 0) {
        $persistentStore.write(JSON.stringify({ids: [], map: {}, ts: Date.now()}), SNAP_KEY);
        return $done({});
    }
    
    // 读旧快照
    var oldStr = $persistentStore.read(SNAP_KEY);
    var old = {ids: [], map: {}, ts: 0};
    try {
        if (oldStr) old = JSON.parse(oldStr);
    } catch(e) {}
    
    var oldIds = {};
    for (var j = 0; j < old.ids.length; j++) {
        oldIds[old.ids[j]] = old.map[old.ids[j]] || null;
    }
    
    var msgs = [];
    
    // 比对：新增商品
    for (var k = 0; k < availIds.length; k++) {
        var curId = availIds[k];
        if (!oldIds[curId]) {
            // 新品
            msgs.push("🆕 " + availMap[curId].name + " · 余" + availMap[curId].stock + "件");
        } else if (availMap[curId].stock > oldIds[curId].stock) {
            // 库存增加
            msgs.push("📈 " + availMap[curId].name + "：" + oldIds[curId].stock + "→" + availMap[curId].stock);
        }
    }
    
    // 通知（首次不通知）
    if (msgs.length > 0 && old.ids.length > 0) {
        $notify("京东试用 · " + availIds.length + "件可申", "", msgs.join("\n"));
    }
    
    // 存新快照
    var newSnap = {
        ids: availIds,
        map: availMap,
        ts: Date.now()
    };
    $persistentStore.write(JSON.stringify(newSnap), SNAP_KEY);
    
    $done({});
}

// ========== 签名过期处理 ==========
function handleFail() {
    var cnt = parseInt($persistentStore.read(FAIL_KEY) || "0") + 1;
    $persistentStore.write(cnt, FAIL_KEY);
    
    if (cnt === 1 || cnt % 4 === 1) {
        $notify("京东试用", "签名过期", "请重新进入京东App → 评价中心 → 试用列表");
    }
    
    $done({});
}
