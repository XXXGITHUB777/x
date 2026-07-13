/*
京东试用监控 - Quantumult X 优化版
==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/api\.m\.jd\.com\/client\.action url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js tag=JD试用监控, enabled=true

============================================================
*/

const K_REQ = 'jdsy_req_v2';
const K_SNAP = 'jdsy_snap_v2';
const K_FAIL = 'jdsy_fail_v2';

const isQX = typeof $task !== 'undefined';
const isMitm = typeof $request !== 'undefined' && typeof $response !== 'undefined';

// ==================== 工具函数 ====================
const store = {
    get: (key) => isQX ? $prefs.valueForKey(key) : null,
    set: (val, key) => isQX ? $prefs.setValueForKey(val, key) : false,
    del: (key) => isQX ? $prefs.removeValueForKey(key) : false
};

function notify(title, subtitle, message) {
    console.log(`\n[${title}]\n${subtitle}\n${message}`);
    if (isQX) $notify(title, subtitle, message);
}

function done(value = {}) {
    if (typeof $done !== 'undefined') $done(value);
}

// ==================== 核心逻辑 ====================

// 增强抓包判定：同时检测 URL 和 Body
function isTrialRequest() {
    if (!$request) return false;
    const urlStr = $request.url || '';
    const bodyStr = $request.body || '';
    return urlStr.includes('getCommentOfficerTrialHome') || bodyStr.includes('getCommentOfficerTrialHome');
}

if (isMitm && isTrialRequest()) {
    runMitm();
} else {
    runCron();
}

function runMitm() {
    // 剔除容易导致重放失败的 Header
    let headers = $request.headers || {};
    const cleanHeaders = {};
    for (let key in headers) {
        let lowerKey = key.toLowerCase();
        if (lowerKey !== 'content-length' && lowerKey !== 'accept-encoding') {
            cleanHeaders[key] = headers[key];
        }
    }

    const reqData = {
        url: $request.url,
        method: $request.method || 'POST',
        headers: cleanHeaders,
        body: $request.body || ''
    };

    store.set(JSON.stringify(reqData), K_REQ);
    store.set('0', K_FAIL); // 重置失败计数

    try {
        const bodyObj = JSON.parse($response.body);
        if (bodyObj.code === "0" || bodyObj.code === 0) {
            notify('🛒 京东试用', '✅ 抓包与缓存成功', '已更新请求令牌，定时任务将以此凭证运行。');
            processData(bodyObj, true);
        } else {
            console.log("抓包响应非预期成功状态: " + JSON.stringify(bodyObj));
            done();
        }
    } catch (e) {
        console.log("抓包响应解析失败: " + e.message);
        done();
    }
}

function runCron() {
    const reqStr = store.get(K_REQ);
    if (!reqStr) {
        console.log('缺少请求缓存，请先抓包');
        return done();
    }

    let reqObj;
    try {
        reqObj = JSON.parse(reqStr);
    } catch (e) {
        console.log('请求缓存解析失败');
        return done();
    }

    $task.fetch(reqObj).then(resp => {
        try {
            const bodyObj = JSON.parse(resp.body);
            // 京东接口通常 code 为 "0" 代表成功
            if (bodyObj && (bodyObj.code === "0" || bodyObj.code === 0) && bodyObj.result) {
                store.set('0', K_FAIL);
                processData(bodyObj, false);
            } else {
                console.log('接口返回非预期状态: ' + resp.body);
                handleFail(bodyObj.message || '凭证可能已失效');
            }
        } catch (e) {
            console.log('定时任务解析失败: ' + e.message);
            handleFail('返回数据非 JSON 格式');
        }
    }, err => {
        console.log('网络请求失败: ' + JSON.stringify(err));
        handleFail('网络连接异常');
    });
}

function processData(data, isFromMitm) {
    if (!data || !data.result) return done();
    
    const acts = data.result.trialActivities || [];
    const available = acts.filter(a => a.claimableNum > 0);
    const availCount = available.length;

    if (availCount === 0) {
        store.set(JSON.stringify({ total: 0, items: {}, ts: Date.now() }), K_SNAP);
        console.log('当前无可申请试用商品。');
        return done();
    }

    // 读取旧快照，使用 Object 字典存储替代原先的并行数组
    const oldSnapStr = store.get(K_SNAP);
    let oldSnap = { total: 0, items: {}, ts: 0 };
    try {
        if (oldSnapStr) oldSnap = JSON.parse(oldSnapStr);
    } catch (e) {}

    let msgs = [];
    let newItems = {};

    for (let act of available) {
        const id = `${act.activityId}_${act.skuId}`;
        const name = act.skuName || `未知商品(${act.skuId})`;
        const currentNum = parseInt(act.claimableNum, 10);
        
        newItems[id] = currentNum;

        const oldNum = oldSnap.items[id];
        if (oldNum === undefined) {
            msgs.push(`🆕 ${name}\n   └─ 余量: ${currentNum}件`);
        } else if (currentNum > oldNum) {
            msgs.push(`📈 ${name}\n   └─ 补货: ${oldNum} → ${currentNum}件`);
        }
    }

    // 状态发生变化才通知
    const hasHistory = Object.keys(oldSnap.items).length > 0;
    
    if (msgs.length > 0 && hasHistory) {
        let title = `京东试用 · 发现新余量 (${availCount})`;
        let subtitle = availCount > oldSnap.total ? `▶ 总可申请数 ${oldSnap.total} → ${availCount}` : `内部余量发生变动`;
        notify(title, subtitle, msgs.join('\n\n'));
    } else if (isFromMitm && !hasHistory) {
        notify('🛒 京东试用监控', '🟢 监控初始化完成', `当前检测到 ${availCount} 件可申请商品，数据已快照。`);
    } else {
        console.log(`执行完毕：总计 ${availCount} 件，无新增/补货变动。`);
    }

    // 存入新快照
    store.set(JSON.stringify({ total: availCount, items: newItems, ts: Date.now() }), K_SNAP);
    done();
}

function handleFail(reason) {
    let failCount = parseInt(store.get(K_FAIL) || '0', 10) + 1;
    store.set(String(failCount), K_FAIL);

    console.log(`请求失败次数: ${failCount}, 原因: ${reason}`);

    // 为了避免频繁打扰，只在第1次、第6次、第11次等节点通知
    if (failCount === 1 || failCount % 5 === 1) {
        notify('⚠️ 京东试用监控失效', `失败累计 ${failCount} 次`, `原因: ${reason}\n请打开京东APP -> 评价中心 -> 试用列表 重新触发抓包！`);
    }
    done();
}
