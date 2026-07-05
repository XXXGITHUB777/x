/*
京东试用监控 v8 - QX 全版本兼容
*/

var REQ_KEY = "jd_trial_req";
var SNAP_KEY = "jd_trial_snap";
var FAIL_KEY = "jd_trial_fail";

// 兼容旧版 QX（$prefs）和新版 QX（$persistentStore）
function read(key) {
    try {
        if (typeof $prefs !== 'undefined' && typeof $prefs.valueForKey === 'function') {
            return $prefs.valueForKey(key);
        }
    } catch(e) {}
    try {
        if (typeof $persistentStore !== 'undefined') {
            return $persistentStore.read(key);
        }
    } catch(e) {}
    return null;
}

function write(key, val) {
    try {
        if (typeof $prefs !== 'undefined' && typeof $prefs.setValueForKey === 'function') {
            return $prefs.setValueForKey(val, key);
        }
    } catch(e) {}
    try {
        if (typeof $persistentStore !== 'undefined') {
            return $persistentStore.write(val, key);
        }
    } catch(e) {}
    return false;
}

// ========== 模式判断 ==========
var isMitm = false;
if (typeof $request !== 'undefined' && typeof $response !== 'undefined') {
    var url = $request.url || "";
    var body = $request.body || "";
    if (url.indexOf("functionId=getCommentOfficerTrialHome") > -1 || 
        body.indexOf("functionId=getCommentOfficerTrialHome") > -1) {
        isMitm = true;
    }
}

if (isMitm) {
    runMitm();
} else {
    runCron();
}

function runMitm() {
    var req = {
        url: $request.url || "",
        method: "POST",
        headers: $request.headers || {},
        body: $request.body || ""
    };
    write(REQ_KEY, JSON.stringify(req));
    write(FAIL_KEY, "0");
    
    $notify("京东试用", "抓取成功", "已缓存请求，每30分钟自动检查");
    
    try {
        var obj = JSON.parse($response.body);
        if (obj && obj.result) {
            processSnap(obj.result);
        }
    } catch(e) {}
    
    $done({});
}

function runCron() {
    var reqStr = read(REQ_KEY);
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
                write(FAIL_KEY, "0");
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

function processSnap(result) {
    var acts = result.trialActivities || [];
    
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
    
    if (availIds.length === 0) {
        write(SNAP_KEY, JSON.stringify({ids: [], map: {}, ts: Date.now()}));
        return $done({});
    }
    
    var oldStr = read(SNAP_KEY);
    var old = {ids: [], map: {}, ts: 0};
    try {
        if (oldStr) old = JSON.parse(oldStr);
    } catch(e) {}
    
    var oldIds = {};
    for (var j = 0; j < old.ids.length; j++) {
        oldIds[old.ids[j]] = old.map[old.ids[j]] || null;
    }
    
    var msgs = [];
    
    for (var k = 0; k < availIds.length; k++) {
        var curId = availIds[k];
        if (!oldIds[curId]) {
            msgs.push("🆕 " + availMap[curId].name + " · 余" + availMap[curId].stock + "件");
        } else if (availMap[curId].stock > oldIds[curId].stock) {
            msgs.push("📈 " + availMap[curId].name + "：" + oldIds[curId].stock + "→" + availMap[curId].stock);
        }
    }
    
    if (msgs.length > 0 && old.ids.length > 0) {
        $notify("京东试用 · " + availIds.length + "件可申", "", msgs.join("\n"));
    }
    
    write(SNAP_KEY, JSON.stringify({
        ids: availIds,
        map: availMap,
        ts: Date.now()
    }));
    
    $done({});
}

function handleFail() {
    var cnt = parseInt(read(FAIL_KEY) || "0") + 1;
    write(FAIL_KEY, "" + cnt);
    
    if (cnt === 1 || cnt % 4 === 1) {
        $notify("京东试用", "签名过期", "请重新进入京东App → 评价中心 → 试用列表");
    }
    
    $done({});
}
