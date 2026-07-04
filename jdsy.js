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
3. 收到抓包成功通知后，脚本即可每半小时自动监控
============================================================
*/

const K_REQ = 'jdsy_req_final';
const K_SNAP = 'jdsy_snap_final';
const K_FAIL = 'jdsy_fail_final';

// ==================== 环境与模式检测 ====================

const isQX = typeof $task !== 'undefined';
const isMitm = typeof $request !== 'undefined' && typeof $response !== 'undefined';

function getEnv(key) {
    if (isQX) return $prefs.valueForKey(key);
    return null;
}

function setEnv(value, key) {
    if (isQX) return $prefs.setValueForKey(value, key);
    return false;
}

function notify(title, subtitle, message) {
    console.log(`[${title}] ${subtitle} - ${message}`);
    if (isQX) $notify(title, subtitle, message);
}

function done(value = {}) {
    if (typeof $done !== 'undefined') $done(value);
}

// ==================== 业务逻辑 ====================

function isTrialRequest() {
    if (!$request) return false;
    var body = $request.body || '';
    return body.indexOf('functionId=getCommentOfficerTrialHome') > -1;
}

if (isMitm && isTrialRequest()) {
    runMitm();
} else {
    runCron();
}

function runMitm() {
    const reqData = {
        url: $request.url || '',
        method: $request.method || 'POST',
        headers: $request.headers || {},
        body: $request.body || ''
    };
    setEnv(JSON.stringify(reqData), K_REQ);
    setEnv('0', K_FAIL);

    notify('京东试用', '抓包成功', '已缓存请求，每30分钟自动监控');

    try {
        const bodyObj = JSON.parse($response.body);
        processData(bodyObj, true);
    } catch (e) {
        done();
    }
}

function runCron() {
    const reqStr = getEnv(K_REQ);
    if (!reqStr) {
        notify('京东试用', '缺少请求缓存', '请先打开京东App进入试用列表触发抓包');
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
                setEnv('0', K_FAIL);
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
    const acts = result.trialActivities || [];

    const available = acts.filter(a => a.claimableNum > 0);
    const availCount = available.length;

    if (availCount === 0) {
        setEnv(JSON.stringify({ total: 0, items: [], raw: [], ts: Date.now() }), K_SNAP);
        return done();
    }

    const oldSnapStr = getEnv(K_SNAP);
    let oldSnap = { total: 0, items: [], raw: [], ts: 0 };
    try {
        if (oldSnapStr) oldSnap = JSON.parse(oldSnapStr);
    } catch (e) {}

    const oldMap = {};
    for (let i = 0; i < oldSnap.items.length; i++) {
        oldMap[oldSnap.items[i]] = oldSnap.raw[i] || null;
    }

    let msgs = [];
    let newItems = [];
    let newRaw = [];

    for (let i = 0; i < available.length; i++) {
        const act = available[i];
        const id = String(act.activityId) + '_' + String(act.skuId);
        newItems.push(id);
        newRaw.push({ id, s: act.claimableNum });

        if (!oldMap[id]) {
            const name = act.skuName || ('SKU:' + act.skuId);
            msgs.push('🆕 ' + name + ' · 余' + act.claimableNum + '件');
        } else if (oldMap[id] && act.claimableNum > oldMap[id].s) {
            const name = act.skuName || ('SKU:' + act.skuId);
            msgs.push('📈 ' + name + '：' + oldMap[id].s + '→' + act.claimableNum);
        }
    }

    if (availCount > oldSnap.total) {
        msgs.push('▶ 可申请商品数 ' + oldSnap.total + '→' + availCount);
    }

    const hadBefore = oldSnap.items.length > 0;

    if (msgs.length > 0 && hadBefore) {
        notify('京东试用 · ' + availCount + '件可申', '', msgs.join('\n'));
    } else if (isFromMitm && !hadBefore) {
        notify('京东试用监控', '✅ 初始化成功', '当前可申请: ' + availCount + '件');
    }

    setEnv(JSON.stringify({ total: availCount, ts: Date.now(), items: newItems, raw: newRaw }), K_SNAP);
    done();
}

function handleFail() {
    let failCount = parseInt(getEnv(K_FAIL) || '0', 10) + 1;
    setEnv(String(failCount), K_FAIL);

    if (failCount === 1 || failCount % 4 === 1) {
        notify('京东试用', '⚠️ 签名过期', '请重新进入京东App → 评价中心 → 试用列表');
    }
    done();
}
