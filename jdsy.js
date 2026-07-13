/*
京东试用监控 - Quantumult X 优化版 v5 (逢错必报版)
==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/api\.m\.jd\.com\/client\.action url script-request-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js tag=JD试用监控, enabled=true

============================================================
*/

const K_REQ = 'jdsy_req_v5';
const K_SNAP = 'jdsy_snap_v5';
const K_FAIL = 'jdsy_fail_v5';

const isQX = typeof $task !== 'undefined';
const isMitm = typeof $request !== 'undefined';
const hasResponse = typeof $response !== 'undefined';

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
    if ($request.method === 'POST' && !$request.body) {
        notify('⚠️ 抓包异常', '未获取到请求体', '请确保 QX 重写规则使用的是 script-request-body！');
        return done();
    }

    let headers = $request.headers || {};
    const cleanHeaders = {};
    
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
        try {
            const bodyObj = JSON.parse($response.body);
            if (bodyObj.code === "0" || bodyObj.code === 0) {
                notify('🛒 京东试用', '✅ 抓包刷新成功', '已更新请求令牌，当前数据有效。');
                processData(bodyObj, true);
            } else {
                done();
            }
        } catch (e) {
            done();
        }
    } else {
        notify('🛒 京东试用', '✅ 抓包刷新成功', '已更新请求令牌，定时任务即可生效。');
        done();
    }
}

function runCron() {
    const reqStr = store.get(K_REQ);
    
    // v5改动：彻底修复丢失缓存时不弹窗的问题
    if (!reqStr) {
        console.log('缺少请求缓存，请先抓包');
        notify('⚠️ 试用监控尚未初始化', '找不到抓包凭证', '👉 请点击桌面的快捷指令，跳转京东抓取一次！');
        return done();
    }

    let reqObj;
    try {
        reqObj = JSON.parse(reqStr);
    } catch (e) {
        notify('⚠️ 缓存数据损坏', '无法解析请求数据', '👉 请点击桌面的快捷指令，重新抓包！');
        return done();
    }

    $task.fetch(reqObj).then(resp => {
        try {
            const bodyObj = JSON.parse(resp.body);
            if (bodyObj && (bodyObj.code === "0" || bodyObj.code === 0) && bodyObj.result) {
                store.set('0', K_FAIL);
                processData(bodyObj, false);
            } else {
                let errorMsg = bodyObj.echo || bodyObj.message || '京东服务器未返回预期数据';
                console.log('接口返回异常: ' + resp.body);
                handleFail(errorMsg);
            }
        } catch (e) {
            console.log('非 JSON 响应内容: ' + resp.body.substring(0, 100));
            handleFail('返回数据非 JSON 格式 (大概率是Cookie已过期被京东拦截)');
        }
    }, err => {
        console.log('网络请求失败: ' + JSON.stringify(err));
        handleFail(`网络请求被拒绝或超时`);
    });
}

function processData(data, isFromMitm) {
    if (!data || !data.result) return done();
    
    const acts = data.result.trialActivities || [];
    const available = acts.filter(a => a.claimableNum > 0);
    const availCount = available.length;

    if (availCount === 0) {
        store.set(JSON.stringify({ total: 0, items: {}, ts: Date.now() }), K_SNAP);
        console.log('当前无可申请商品，静默退出。');
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
            msgs.push(`🆕 ${name} | 余 ${currentNum}件`);
        } else if (currentNum > oldNum) {
            msgs.push(`📈 ${name} | ${oldNum}→${currentNum}件`);
        } else {
            msgs.push(`🟢 ${name} | 余 ${currentNum}件`);
        }
    }

    const displayMsgs = msgs.slice(0, 10).join('\n');
    const moreText = msgs.length > 10 ? `\n...等共 ${availCount} 件` : '';

    if (isFromMitm) {
        console.log(`初始化记录了 ${availCount} 件商品。`);
    } else {
        let title = `🛒 京东试用快报 (${availCount}件)`;
        let subtitle = availCount > oldSnap.total ? `▶ 发现新增！总数 ${oldSnap.total} → ${availCount}` : `当前可申请清单`;
        notify(title, subtitle, displayMsgs + moreText);
    }

    store.set(JSON.stringify({ total: availCount, items: newItems, ts: Date.now() }), K_SNAP);
    done();
}

function handleFail(reason) {
    let failCount = parseInt(store.get(K_FAIL) || '0', 10) + 1;
    store.set(String(failCount), K_FAIL);

    // v5改动：去掉除余运算，只要失败，每次必弹窗！
    notify('⚠️ 京东试用凭证已失效', `已连续失效 ${failCount} 次`, `原因: ${reason}\n👉 请立即点击桌面的快捷指令刷新！`);
    done();
}
