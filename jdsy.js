/*
京东试用监控 - Quantumult X v10 (修复缓存写入失效问题)
==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-request-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js tag=JD试用监控, enabled=true

============================================================
v10 变更 (修复根本 Bug):
1. 【关键修复】之前 store.get/set/del 和 notify() 都用 `isQX`(=typeof $task!=='undefined')
   来判断是否可以调用 $prefs / $notify。但 $task 只在【定时任务】上下文存在，
   在【MITM 抓包 script-request-body】上下文中 $task 是 undefined！
   导致每次在京东 App 里刷新试用页触发抓包时，`store.set()` 直接被短路成
   `false`，$prefs.setValueForKey 根本没有被调用，新抓的 h5st 从未真正落盘。
   定时任务用的永远是很久以前的旧缓存 -> h5st 早已过期 -> 一直返回 code:3。
   现在改为直接探测 `$prefs` / `$notify` 是否存在，MITM 和定时任务两种场景
   都能正确读写缓存、发送通知。
2. runMitm() 增加 try/catch，任何异常都会被捕获并通知，不会再无声无息地
   导致缓存没更新还看不到任何报错。
3. 缓存 key 版本升级到 v10，避免旧版本(可能一直没写入成功)的脏数据干扰判断，
   强制下一次重新抓包。
4. 其余逻辑（保留 h5st 原样、跳过 OPTIONS、失败诊断信息等）保持不变。
============================================================
*/

const VERSION = 'v10';
const K_REQ = 'jdsy_req_v10';
const K_SNAP = 'jdsy_snap_v10';
const K_FAIL = 'jdsy_fail_v10';
const K_TIME = 'jdsy_time_v10';

const isMitm = typeof $request !== 'undefined';
const isTask = typeof $task !== 'undefined';
// $prefs / $notify 在 MITM(script-request-body) 和 定时任务(task_local) 两种
// 上下文中都是可用的，不能用 $task 是否存在来判断，否则 MITM 场景下会被误判为不可用。
const hasPrefs = typeof $prefs !== 'undefined';
const hasNotify = typeof $notify !== 'undefined';

const store = {
    get: (key) => hasPrefs ? $prefs.valueForKey(key) : null,
    set: (val, key) => hasPrefs ? $prefs.setValueForKey(val, key) : false,
    del: (key) => hasPrefs ? $prefs.removeValueForKey(key) : false
};

function notify(title, subtitle, message) {
    console.log(`\n[${title}]\n${subtitle}\n${message}`);
    if (hasNotify) $notify(title, subtitle, message);
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
} else if (isTask && !isMitm) {
    runCron();
} else {
    done();
}

function runMitm() {
    try {
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

        const okReq = store.set(JSON.stringify(reqData), K_REQ);
        store.set('0', K_FAIL);
        // 记录抓包时间
        store.set(String(Date.now()), K_TIME);

        if (!hasPrefs) {
            // 理论上不应该发生，一旦发生说明 QX 版本/上下文异常，明确提示出来
            notify('⚠️ 抓包失败', `[${VERSION}] $prefs 不可用`, '当前环境无法写入缓存，请检查 QX 版本或重写规则配置。');
            return done();
        }

        console.log(`[${VERSION}] 抓包成功，已存储请求, 写入结果=${okReq}`);
        notify('🛒 京东试用', `✅ 抓包刷新成功 [${VERSION}]`, '已更新请求令牌，定时任务即可生效。');
        done();
    } catch (e) {
        notify('⚠️ 抓包脚本异常', `[${VERSION}] runMitm 出错`, `${e && e.message ? e.message : e}`);
        done();
    }
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

    // h5st 通常只在较短时间窗口内有效，缓存太久基本必然失败，提前提示更直观
    if (ageMin > 55) {
        console.log(`[${VERSION}] 警告：缓存已超过 55 分钟，h5st 大概率已过期`);
    }

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
