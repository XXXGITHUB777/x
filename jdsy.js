/*
京东试用监控 - Quantumult X 版
功能：自动抓包 + 自动比对 + 自动通知 一体化
一个脚本文件搞定，上传 GitHub 直接远程引用

==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/api\.m\.jd\.com\/(client\.action|api) url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用监控, enable=true

【使用方法】
1. 开启 MitM 和重写
2. 打开京东 APP → 评价中心 → 试用列表
3. 收到"初始化成功"通知后，脚本开始自动监控
*/

var K_REQ = "jdsy_req_v99";
var K_SNAP = "jdsy_snap_v99";
var K_FAIL = "jdsy_fail_v99";

var isQX = (typeof $task !== "undefined");
var isMitm = (typeof $request !== "undefined" && typeof $response !== "undefined");

function notify(t, s, m) {
    console.log("[" + t + "] " + s + " : " + m);
    if (isQX && typeof $notify === "function") $notify(t, s, m);
}

function gs(key) {
    if (typeof $persistentStore === "undefined") return null;
    try { return $persistentStore.read(key); } catch(e) { return null; }
}

function ss(key, val) {
    if (typeof $persistentStore === "undefined") return false;
    try { return $persistentStore.write(val, key); } catch(e) { return false; }
}

function done(v) {
    if (typeof $done === "function") $done(v || {});
}

// 检查是否是目标响应（URL 或 body 里包含 functionId）
function isTrialApi() {
    if (!$request || !$request.url) return false;
    var url = $request.url;
    var body = $request.body || "";
    
    // 情况 1: functionId 在 URL 查询参数（client.action?functionId=xxx）
    if (url.indexOf("functionId=getCommentOfficerTrialHome") > -1) return true;
    
    // 情况 2: URL 是 /api 或 /client.action，且 body 里包含 functionId
    if ((url.indexOf("/api") > -1 || url.indexOf("/client.action") > -1) && 
        body.indexOf("functionId=getCommentOfficerTrialHome") > -1) {
        return true;
    }
    
    return false;
}

if (isMitm && isTrialApi()) {
    runMitm();
} else {
    runCron();
}

function runMitm() {
    // 保存完整请求
    var req = {
        url: $request.url,
        method: $request.method || "POST",
        headers: $request.headers,
        body: $request.body
    };
    
    ss(K_REQ, JSON.stringify(req));
    ss(K_FAIL, "0");
    
    console.log("[MITM] 请求已缓存到 " + K_REQ);
    
    // 尝试解析响应
    try {
        var obj = JSON.parse($response.body);
        if (!obj || !obj.result) {
            console.log("[MITM] 响应无 result 字段");
            notify("京东试用", "抓包异常", "响应数据格式不符");
            return done();
        }
        console.log("[MITM] 响应解析成功");
        processData(obj, true);
    } catch(e) {
        console.log("[MITM] JSON 解析失败: " + e);
        done();
    }
}

function runCron() {
    console.log("[CRON] 启动");
    
    var reqStr = gs(K_REQ);
    if (!reqStr) {
        console.log("[CRON] 未找到缓存: " + K_REQ);
        notify("京东试用", "缺少缓存", "请打开京东App进入试用列表触发MITM");
        return done();
    }
    
    var req;
    try { req = JSON.parse(reqStr); } catch(e) { 
        console.log("[CRON] 缓存解析失败");
        return done(); 
    }

    $task.fetch(req).then(function(resp) {
        try {
            var obj = JSON.parse(resp.body);
            if (obj && obj.result) {
                ss(K_FAIL, "0");
                processData(obj, false);
            } else {
                onFail();
            }
        } catch(e) {
            onFail();
        }
    }, function(err) {
        console.log("[CRON] fetch 失败: " + err);
        onFail();
    });
}

function processData(data, fromMitm) {
    if (!data || !data.result) return done();
    
    var r = data.result;
    var acts = r.trialActivities || [];
    
    // 只统计 claimableNum > 0 的商品
    var avail = [];
    for (var i = 0; i < acts.length; i++) {
        if (acts[i].claimableNum > 0) {
            avail.push(acts[i]);
        }
    }
    
    console.log("[DATA] 商品总数=" + acts.length + " 可申请=" + avail.length);
    
    // 售光静默
    if (avail.length === 0) {
        ss(K_SNAP, JSON.stringify({total:0, items:[], raw:[], ts:Date.now()}));
        return done();
    }

    var oldStr = gs(K_SNAP);
    var old = null;
    try { old = oldStr ? JSON.parse(oldStr) : null; } catch(e) {}
    if (!old) old = {total:0, items:[], raw:[]};

    var oldMap = {};
    for (var j = 0; j < old.items.length; j++) {
        oldMap[old.items[j]] = old.raw[j] || null;
    }

    var msgs = [];
    var newItems = [];
    var newRaw = [];

    for (var k = 0; k < avail.length; k++) {
        var act = avail[k];
        var id = String(act.activityId) + "_" + String(act.skuId);
        newItems.push(id);
        newRaw.push({id:id, s:act.claimableNum});

        if (!oldMap[id]) {
            var nm = act.skuName || ("SKU" + act.skuId);
            msgs.push("🆕 " + nm + " · 余" + act.claimableNum + "件");
        } else if (oldMap[id] && act.claimableNum > oldMap[id].s) {
            var nm2 = act.skuName || ("SKU" + act.skuId);
            msgs.push("📈 " + nm2 + "：" + oldMap[id].s + "→" + act.claimableNum);
        }
    }

    if (avail.length > old.total) {
        msgs.push("▶ 可申请数 " + old.total + " → " + avail.length);
    }

    var hadBefore = (old.items.length > 0);
    
    // 有变化才通知（而且之前必须有快照，才不算首次）
    if (msgs.length > 0 && hadBefore) {
        notify("京东试用 · " + avail.length + "件可申", "", msgs.join("\n"));
    }
    
    // MITM 首次成功时提示
    if (fromMitm && !hadBefore) {
        notify("京东试用监控", "初始化成功", "当前可申请: " + avail.length + "件\n已抓取参数，开始自动监控");
    }
    
    if (msgs.length === 0) {
        console.log("[DATA] 无变化，静默");
    }

    // 保存快照
    var snap = {
        total: avail.length,
        ts: Date.now(),
        items: newItems,
        raw: newRaw
    };
    ss(K_SNAP, JSON.stringify(snap));
    done();
}

function onFail() {
    var c = parseInt(gs(K_FAIL) || "0", 10) + 1;
    ss(K_FAIL, String(c));
    
    // 首次失败立即通知，之后每 4 次提醒一次（避免骚扰）
    if (c === 1 || c % 4 === 1) {
        notify("京东试用", "签名过期", "请重新进入京东App → 评价中心 → 试用列表");
    }
    done();
}
