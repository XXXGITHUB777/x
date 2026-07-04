/*
============================================================
京东试用监控 - Quantumult X 版
功能：自动抓包 + 自动比对 + 自动通知 一体化
一个脚本文件搞定，上传 GitHub 直接远程引用

==================== QX 配置 ====================

[rewrite_local]
^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
# 注意：用 0,30 替代 */30，避开 JS 注释闭合 Bug
0,30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用监控, enable=true
event network-changed script-path=https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用网络触发, enable=true

【使用方法】
1. 开启 MitM 和重写
2. 打开京东 APP → 评价中心 → 试用列表
3. 收到抓包成功通知后，脚本即可每半小时自动监控
============================================================
*/

const K_REQ = 'jdsy_req_v7';
const K_SNAP = 'jdsy_snap_v7';
const K_FAIL = 'jdsy_fail_v7';

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
    if (isQX) $notify(title, subtitle, message);
    else console.log(`[${title}] ${subtitle}\n${message}`);
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
    // 存储请求供重放
    const reqData = {
        url: $request.url,
        method: $request.method || 'POST',
        headers: $request.headers || {},
        body: $request.body || ''
    };
    setEnv(JSON.stringify(reqData), K_REQ);
    setEnv("0", K_FAIL); // 成功抓包，重置失败次数

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
            // 校验是否有 result，防止 sign 失效
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

    // 如果全部售光 (总数为0或无商品)，静默并清空快照
    if (total === 0 || acts.length === 0) {
        setEnv(JSON.stringify({ total: 0, items: [] }), K_SNAP);
        return done();
    }

    const oldSnapStr = getEnv(K_SNAP);
    const oldSnap = oldSnapStr ? JSON.parse(oldSnapStr) : { total: 0, items: [] };
    
    let newItemsIds = [];
    let newItemsMap = {};
    
    acts.forEach(act => {
        const id = act.skuId || act.activityId;
        newItemsIds.push(id);
        newItemsMap[id] = act;
    });

    let outMsgs = [];

    // 1. 判断新商品
    newItemsIds.forEach(id => {
        if (oldSnap.items.indexOf(id) === -1) {
            const name = newItemsMap[id].skuName || ("SKU: " + id);
            outMsgs.push("🆕 新上架: " + name);
        }
    });

    // 2. 判断总名额增加
    if (total > oldSnap.total) {
        outMsgs.push(`📈 可申请总名额增加: ${oldSnap.total} -> ${total}`);
    }

    // 执行通知
    if (outMsgs.length > 0) {
        notify(`京东试用更新 (可申${total}件)`, "", outMsgs.join("\n"));
    } else if (isFromMitm && oldSnap.items.length === 0) {
        notify("京东试用监控", "✅ 初始化成功", "已成功抓取参数，开始自动监控");
    }

    // 覆盖新快照
    setEnv(JSON.stringify({ total: total, items: newItemsIds }), K_SNAP);
    done();
}

function handleFail() {
    let failCount = parseInt(getEnv(K_FAIL) || "0", 10) + 1;
    setEnv(failCount.toString(), K_FAIL);

    // 连续失败阶梯通知，防止一直弹窗烦人
    if (failCount === 1 || failCount % 4 === 1) {
        notify(
            "京东试用 ⚠️ 签名过期", 
            "请求参数已失效", 
            "请重新进入京东App->评价中心->试用列表触发抓包"
        );
    }
    done();
}
