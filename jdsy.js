/*
京东试用监控 - Quantumult X v9 (诊断版)
==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-request-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js tag=JD试用监控, enabled=true

============================================================
v9 变更:
1. 只用 script-request-body（去掉 response-body 避免冲突）
2. 跳过 OPTIONS 预检请求
3. 保留 h5st 原样不动
4. 通知中显示版本号，方便确认脚本已更新
5. 失败时显示完整响应内容（前200字），用于诊断
6. 记录抓包时间，失败时显示请求年龄
============================================================
*/

const VERSION = 'v9';
const K_REQ = 'jdsy_req_v9';
const K_SNAP = 'jdsy_snap_v9';
const K_FAIL = 'jdsy_fail_v9';
const K_TIME = 'jdsy_time_v9';

const isQX = typeof $task !== 'undefined';
const isMitm = typeof $request !== 'undefined';

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
    // 跳过 OPTIONS 预检请求
    if ($request.method === 'OPTIONS') {
        console.log(`[${VERSION}] 跳过 OPTIONS 预检请求`);
        return done();
    }

    if ($request.method === 'POST' && !$request.body) {
        notify('⚠️ 抓包异常', `[${VERSION}] 未获取到请求体`, '请确保 QX 重写规则使用的是 script-request-body！');
        return done();
    }

    // 清理请求头
    let headers = $request.headers || {};
    const cleanHeaders = {};

    for (let key in headers) {
        let lowerKey = key.toLowerCase();
        // 过滤掉会引起问题的头
        if (lowerKey === 'content-length' || 
            lowerKey === 'accept-encoding' ||
            lowerKey === 'host' ||
            lowerKey === 'connection' ||
            lowerKey === 'priority' ||
            lowerKey === 'sec-fetch-site' ||
            lowerKey === 'sec-fetch-mode' ||
            lowerKey === 'sec-fetch-dest') continue;

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

    // 原样存储请求（保留 h5st 不做任何修改）
    const reqData = {
        url: $request.url,
        method: $request.method || 'POST',
        headers: cleanHeaders,
        body: $request.body || ''
    };

    store.set(JSON.stringify(reqData), K_REQ);
    store.set('0', K_FAIL);
    // 记录抓包时间
    store.set(String(Date.now()), K_TIME);

    console.log(`[${VERSION}] 抓包成功，已存储请求`);
    notify('🛒 京东试用', `✅ 抓包刷新成功 [${VERSION}]`, '已更新请求令牌，定时任务即可生效。');
    done();
}

function runCron() {
    const reqStr = store.get(K_REQ);

    if (!reqStr) {
        notify('⚠️ 试用监控尚未初始化', `[${VERSION}] 找不到抓包凭证`, '👉 请点击桌面的快捷指令，跳转京东抓取一次！');
        return done();
    }

    let reqObj;
    try {
        reqObj = JSON.parse(reqStr);
    } catch (e) {
        notify('⚠️ 缓存数据损坏', `[${VERSION}] 无法解析请求数据`, '👉 请重新抓包！');
        return done();
    }

    // 检测无效缓存
    if (reqObj.method === 'OPTIONS' || !reqObj.body) {
        notify('⚠️ 缓存数据异常', `[${VERSION}] 存储的请求无效`, '👉 请重新抓包！');
        return done();
    }

    // 计算请求年龄
    const captureTime = parseInt(store.get(K_TIME) || '0', 10);
    const ageMin = captureTime > 0 ? Math.floor((Date.now() - captureTime) / 60000) : -1;
    const ageStr = ageMin >= 0 ? `${ageMin}分钟前` : '未知';

    console.log(`[${VERSION}] 开始执行定时任务，请求年龄: ${ageStr}`);

    // 原样重放请求，保留 h5st
    $task.fetch(reqObj).then(resp => {
        try {
            if (!resp || !resp.body) {
                return handleFail(`京东服务器返回了空数据\n请求年龄: ${ageStr}`);
            }

            const bodyStr = resp.body;
            const bodyObj = JSON.parse(bodyStr);

            if (bodyObj && (bodyObj.code === "0" || bodyObj.code === 0) && bodyObj.result) {
                store.set('0', K_FAIL);
                processData(bodyObj, false);
            } else {
                // 详细记录失败原因，包含完整响应内容
                let errorMsg = bodyObj.echo || bodyObj.message || bodyObj.msg || '无错误消息';
                let respPreview = bodyStr.substring(0, 200);
                handleFail(`code=${bodyObj.code}, msg=${errorMsg}\n请求年龄: ${ageStr}\n响应内容: ${respPreview}`);
            }
        } catch (e) {
            // JSON 解析失败，记录原始响应
            let rawPreview = resp.body ? resp.body.substring(0, 200) : '(空)';
            handleFail(`JSON解析失败\n请求年龄: ${ageStr}\n原始响应: ${rawPreview}`);
        }
    }, err => {
        handleFail(`网络请求失败: ${err || '超时或被拒绝'}\n请求年龄: ${ageStr}`);
    });
}

function processData(data, isFromMitm) {
    if (!data || !data.result) return done();

    const acts = data.result.trialActivities || [];
    const available = acts.filter(a => a.claimableNum > 0);
    const availCount = available.length;

    if (availCount === 0) {
        store.set(JSON.stringify({ total: 0, items: {}, ts: Date.now() }), K_SNAP);
        console.log(`[${VERSION}] 当前无可申请商品，静默退出。`);
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
        const name = act.skuName || act.skuTitle || `未知商品(${act.skuId})`;
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
        console.log(`[${VERSION}] 初始化记录了 ${availCount} 件商品。`);
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

    notify(`⚠️ 京东试用失效 [${VERSION}]`, `已连续失效 ${failCount} 次`, `${reason}\n👉 请重新抓包！`);
    done();
}
