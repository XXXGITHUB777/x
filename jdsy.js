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
event network-changed script-path=https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用网络触发, enable=true

【使用方法】
1. 开启 MitM 和重写
2. 打开京东 APP → 评价中心 → 试用列表
3. 收到抓包成功通知后，脚本即可每半小时自动监控
============================================================

const K_REQ = 'jdsy_req_v7';
const K_SNAP = 'jdsy_snap_v7';
const K_FAIL = 'jdsy_fail_v7';

// ==================== 环境检测 ====================
const isQX = typeof $task !== 'undefined';
const isMitm = typeof $request !== 'undefined' && typeof $response !== 'undefined';

function notify(title, subtitle, message) {
    if (isQX) $notify(title, subtitle, message);
    else console.log(`[${title}] ${subtitle}\n${message}`);
}

function getEnv(key) {
    if (isQX && typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
    return null;
}

function setEnv(value, key) {
    if (isQX && typeof $prefs !== 'undefined') return $prefs.setValueForKey(value, key);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.write(value, key);
    return false;
}

function done(value = {}) {
    if (typeof $done !== 'undefined') $done(value);
}

// ==================== 核心逻辑 ====================

if (isMitm) {
    runMitm();
} else {
    runCron();
}

function runMitm() {
    // 存储完整请求供 cron 重放
    const reqData = {
        url: $request.url || '',
        method: $request.method || 'POST',
        headers: $request.headers || {},
        body: $request.body || ''
    };
    setEnv(JSON.stringify(reqData), K_REQ);
    setEnv("0", K_FAIL);

    try {
        const bodyObj = JSON.parse($response.body);
        processData(bodyObj, true);
    } catch (e) {
        console.log("解析响应体失败: " + e);
        done();
    }
}

function runCron() {
    const reqStr = getEnv(K_REQ);
    if (!reqStr) {
        notify("京东试用监控", "⚠️ 缺少请求参数", "请先打开京东App进入试用列表抓包");
        return done();
    }

    let reqObj;
    try {
        reqObj = JSON.parse(reqStr);
    } catch (e) {
        return done();
    }

    $task.fetch(reqObj).then(resp => {
        try {
            const bodyObj = JSON.parse(resp.body);
            if (bodyObj && bodyObj.result) {
                setEnv("0", K_FAIL);
                processData(bodyObj, false);
            } else {
                handleFail();
            }
        } catch (e) {
            handleFail();
        }
    }, err => {
        handleFail();
    });
}

function processData(data, isFromMitm) {
    if (!data || !data.result) return done();
    
    const result = data.result;
    const total = result.totalClaimableNum || 0;
    const acts = result.trialActivities || [];

    // 售光静默
    if (total === 0 || acts.length === 0) {
        setEnv(JSON.stringify({ total: 0, items: [], ts: Date.now() }), K_SNAP);
        return done();
    }

    const oldSnapStr = getEnv(K_SNAP);
    let oldSnap = { total: 0, items: [], ts: 0 };
    try {
        if (oldSnapStr) oldSnap = JSON.parse(oldSnapStr);
    } catch (e) {}

    // 构建当前 key 集合：activityId + skuId
    let newItems = [];
    let newKeys = new Set();
    
    acts.forEach(act => {
        const key = (act.activityId || '') + '_' + (act.skuId || '');
        newItems.push({ key, act });
        newKeys.add(key);
    });

    let outMsgs = [];

    // 1. 新上架
    newItems.forEach(({ key, act }) => {
        if (!oldSnap.items || oldSnap.items.indexOf(key) === -1) {
            const name = act.skuName || ("SKU:" + (act.skuId || act.activityId));
            let msg = "🆕 " + name;
            if (act.claimableNum > 0) msg += " · 余" + act.claimableNum + "件";
            outMsgs.push(msg);
        }
    });

    // 2. 可申请总数增加
    if (total > oldSnap.total) {
        outMsgs.push("▶ 可申请 +" + (total - oldSnap.total) + "（" + oldSnap.total + "→" + total + "）");
    }

    // 通知
    if (outMsgs.length > 0 && oldSnap.items && oldSnap.items.length > 0) {
        notify("京东试用 · 可申请 " + total + " 件", "", outMsgs.join("\n"));
    } else if (isFromMitm && oldSnap.items.length === 0) {
        notify("京东试用监控", "✅ 初始化成功", "已成功抓取参数，开始自动监控\n当前可申请 " + total + " 件");
    }

    // 存储新快照
    const newSnap = {
        total: total,
        ts: Date.now(),
        items: newItems.map(x => x.key)
    };
    setEnv(JSON.stringify(newSnap), K_SNAP);
    done();
}

function handleFail() {
    let failCount = parseInt(getEnv(K_FAIL) || "0", 10) + 1;
    setEnv(failCount.toString(), K_FAIL);

    if (failCount === 1 || failCount % 4 === 1) {
        notify(
            "京东试用 ⚠️ 签名过期",
            "请求参数已失效",
            "请重新进入京东App → 评价中心 → 试用列表触发抓包"
        );
    }
    done();
}
