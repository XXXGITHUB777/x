/*
京东试用监控 - Quantumult X 优化版 v3
==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/api\.m\.jd\.com\/client\.action url script-request-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js tag=JD试用监控, enabled=true

============================================================
*/

const K_REQ = 'jdsy_req_v3';
const K_SNAP = 'jdsy_snap_v3';
const K_FAIL = 'jdsy_fail_v3';

const isQX = typeof $task !== 'undefined';
const isMitm = typeof $request !== 'undefined';
const hasResponse = typeof $response !== 'undefined';

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

function isTrialRequest() {
    if (!$request) return false;
    const urlStr = $request.url || '';
    const bodyStr = $request.body || '';
    return urlStr.includes('getCommentOfficerTrialHome') || bodyStr.includes('getCommentOfficerTrialHome');
}

if (isMitm && isTrialRequest()) {
    runMitm();
} else if (isQX && !isMitm) {
    runCron();
} else {
    done();
}

function runMitm() {
    // 严格检测是否抓到了 body
    if ($request.method === 'POST' && !$request.body) {
        notify('⚠️ 抓包异常', '未获取到请求体 (Body)', '请将 QX 重写规则中的 script-response-body 改为 script-request-body 后重新抓包！');
        return done();
    }

    let headers = $request.headers || {};
    const cleanHeaders = {};
    
    // 清洗并规范化请求头 (极度重要：防止 $task.fetch 解析失败)
    for (let key in headers) {
        let lowerKey = key.toLowerCase();
        if (lowerKey === 'content-length' || lowerKey === 'accept-encoding') continue;

        if (lowerKey === 'content-type') {
            cleanHeaders['Content-Type'] = headers[key];
        } else if (lowerKey === 'cookie') {
            cleanHeaders['Cookie'] = headers[key];
        } else if (lowerKey === 'user-agent') {
            cleanHeaders['User-Agent'] = headers[key];
        } else {
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
    store.set('0', K_FAIL);

    if (hasResponse) {
        // 如果用户坚持用 script-response-body 且运气好抓到了 body
        try {
            const bodyObj = JSON.parse($response.body);
            if (bodyObj.code === "0" || bodyObj.code === 0) {
                notify('🛒 京东试用', '✅ 抓包与缓存成功', '已缓存双向请求，定时任务即可生效。');
                processData(bodyObj, true);
            } else {
                done();
            }
        } catch (e) {
            done();
        }
    } else {
        // 使用 script-request-body (推荐模式)
        notify('🛒 京东试用', '✅ 抓包与缓存成功', '已更新安全请求令牌，将于下次定时任务开始比对。');
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
        return done();
    }

    $task.fetch(reqObj).then(resp => {
        try {
            const bodyObj = JSON.parse(resp.body);
            if (bodyObj && (bodyObj.code === "0" || bodyObj.code === 0) && bodyObj.result) {
                store.set('0', K_FAIL);
                processData(bodyObj, false);
            } else {
                let errorMsg = bodyObj.echo || bodyObj.message || '凭证失效或请求参数错误';
                console.log('接口返回异常: ' + resp.body);
                handleFail(errorMsg);
            }
        } catch (e) {
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

    const hasHistory = Object.keys(oldSnap.items).length > 0;
    
    if (msgs.length > 0 && hasHistory) {
        let title = `京东试用 · 发现新余量 (${availCount})`;
        let subtitle = availCount > oldSnap.total ? `▶ 总可申请数 ${oldSnap.total} → ${availCount}` : `内部余量发生变动`;
        notify(title, subtitle, msgs.join('\n\n'));
    } else if (isFromMitm && !hasHistory) {
        console.log(`初始化记录了 ${availCount} 件商品。`);
    } else {
        console.log(`执行完毕：总计 ${availCount} 件，无变动。`);
    }

    store.set(JSON.stringify({ total: availCount, items: newItems, ts: Date.now() }), K_SNAP);
    done();
}

function handleFail(reason) {
    let failCount = parseInt(store.get(K_FAIL) || '0', 10) + 1;
    store.set(String(failCount), K_FAIL);

    if (failCount === 1 || failCount % 5 === 1) {
        notify('⚠️ 京东试用监控失效', `累计失败 ${failCount} 次`, `原因: ${reason}\n请打开京东APP -> 评价中心 -> 试用列表 重新抓包！`);
    }
    done();
}
