/***
京东试用监控 - Quantumult X 版
功能：自动抓包 + 自动比对 + 自动通知 一体化
一个脚本文件搞定，上传 GitHub 直接远程引用

==================== QX 配置 ====================

[rewrite_local]
^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用监控, enable=true

【使用方法】
1. 开启 MitM 和重写
2. 打开京东 APP → 评价中心 → 试用列表
3. 收到初始化成功通知后，脚本即可每半小时自动监控
***********************************************************/

var K_REQ = "jdsy_req_v11";
var K_SNAP = "jdsy_snap_v11";
var K_FAIL = "jdsy_fail_v11";

var isQX = (typeof $task !== "undefined");
var isMitm = (typeof $request !== "undefined" && typeof $response !== "undefined" && $request.url.indexOf("functionId=getCommentOfficerTrialHome") > -1);

function notify(t, s, m) {
    console.log("[" + t + "] " + s + " : " + m);
    if (isQX) $notify(t, s, m);
}

function gs(key) {
    return $persistentStore.read(key);
}

function ss(key, val) {
    $persistentStore.write(val, key);
}

function done(v) {
    if (typeof $done !== "undefined") $done(v || {});
}

if (isMitm) {
    runMitm();
} else {
    runCron();
}

function runMitm() {
    var req = {
        url: $request.url,
        method: $request.method || "POST",
        headers: $request.headers,
        body: $request.body
    };
    ss(K_REQ, JSON.stringify(req));
    ss(K_FAIL, "0");
    try {
        processData(JSON.parse($response.body), true);
    } catch(e) {
        done();
    }
}

function runCron() {
    var reqStr = gs(K_REQ);
    if (!reqStr) {
        notify("京东试用", "缺少缓存", "先打开京东App → 评价中心 → 试用列表");
        return done();
    }
    var req;
    try { req = JSON.parse(reqStr); } catch(e) { return done(); }

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
    }, function() {
        onFail();
    });
}

function processData(data, fromMitm) {
    if (!data || !data.result) return done();
    var r = data.result;
    var acts = r.trialActivities || [];

    var avail = [];
    for (var i = 0; i < acts.length; i++) {
        if (acts[i].claimableNum > 0) {
            avail.push(acts[i]);
        }
    }

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
        msgs.push("▶ 可申请商品数 +" + (avail.length - old.total) + "（" + old.total + "→" + avail.length + "）");
    }

    var hadBefore = (old.items.length > 0);
    if (msgs.length > 0 && hadBefore) {
        notify("京东试用 · " + avail.length + "件可申", "", msgs.join("\n"));
    } else if (fromMitm && !hadBefore) {
        notify("京东试用监控", "初始化成功", "当前可申请: " + avail.length + "件\n已抓取参数，开始自动监控");
    }

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
    if (c === 1 || c % 4 === 1) {
        notify("京东试用", "签名过期", "请重新进入京东App → 评价中心 → 试用列表");
    }
    done();
}
