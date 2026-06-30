/*
============================================================
夸克网盘自动签到 - Quantumult X 版
功能：自动抓包 + 自动存储 + 自动签到 一体化
一个脚本文件搞定，上传 GitHub 直接远程引用

==================== QX 配置 ====================

[rewrite_local]
^https?:\/\/drive-m\.quark\.cn\/1\/clouddrive\/capacity\/growth\/info url script-request-header https://raw.githubusercontent.com/你的用户名/你的仓库/main/quark_checkin.js
^https?:\/\/drive-m\.quark\.cn\/1\/clouddrive\/capacity\/growth\/sign url script-request-header https://raw.githubusercontent.com/你的用户名/你的仓库/main/quark_checkin.js

[mitm]
hostname = drive-m.quark.cn, coral2.quark.cn

[task_local]
0 9 * * * https://raw.githubusercontent.com/你的用户名/你的仓库/main/quark_checkin.js tag=夸克网盘签到, enabled=true

【使用方法】
1. 把上面链接替换成你 GitHub 的 raw 链接
2. 开启 MitM 和重写
3. 打开夸克网盘 APP → 我的 → 签到页面
4. 收到抓包成功通知就 OK，之后每天自动签到
5. 多账号：每个账号分别打开一次 APP 即可

============================================================
*/

const STORAGE_KEY = 'quark_checkin_accounts';

// ==================== 环境检测 ====================

const isQX = typeof $task !== 'undefined';
const isSurge = typeof $httpClient !== 'undefined';
const isLoon = typeof $loon !== 'undefined';

function getEnv(key) {
    if (isQX) return $prefs.valueForKey(key);
    if (isSurge || isLoon) return $persistentStore.read(key);
    return null;
}

function setEnv(key, value) {
    if (isQX) return $prefs.setValueForKey(value, key);
    if (isSurge || isLoon) return $persistentStore.write(value, key);
    return false;
}

function notify(title, subtitle, message) {
    console.log(`[${title}] ${subtitle} - ${message}`);
    if (isQX) $notify(title, subtitle, message);
    else if (isSurge || isLoon) $notification.post(title, subtitle, message);
}

function done(value = {}) {
    if (isQX || isSurge || isLoon) $done(value);
}

// ==================== 工具函数 ====================

function convertBytes(b) {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let i = 0;
    while (b >= 1024 && i < units.length - 1) {
        b /= 1024;
        i++;
    }
    return `${b.toFixed(2)} ${units[i]}`;
}

function parseCookie(str) {
    const obj = {};
    if (!str) return obj;
    str.split(';').forEach(item => {
        const [k, ...v] = item.trim().split('=');
        if (k && v.length) obj[k] = v.join('=');
    });
    return obj;
}

function parseQuery(url) {
    const params = {};
    const m = url.match(/\?(.*)/);
    if (!m) return params;
    m[1].split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k) params[k] = decodeURIComponent(v || '');
    });
    return params;
}

// ==================== 账号存储 ====================

function getAccounts() {
    try {
        const data = getEnv(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveAccount(account) {
    const list = getAccounts();
    const idx = list.findIndex(a => a.kps === account.kps);
    if (idx >= 0) list[idx] = { ...list[idx], ...account };
    else list.push(account);
    setEnv(STORAGE_KEY, JSON.stringify(list));
    return list.length;
}

// ==================== 抓包模式 ====================

function capture() {
    const headers = $request.headers;
    const cookie = parseCookie(headers['Cookie'] || headers['cookie'] || '');
    const query = parseQuery($request.url);

    const kps = cookie.kps || query.kps;

    if (!kps) {
        console.log('⚠️ 未抓到 kps，请确保已登录夸克网盘');
        done({});
        return;
    }

    const account = {
        kps: kps,
        sign: cookie.sign || query.sign || '',
        vcode: cookie.vcode || query.vcode || '',
        user: cookie.__wpkis1stloginuser || cookie.user || cookie.kpnick || `账号${getAccounts().length + 1}`,
        ua: headers['User-Agent'] || headers['user-agent'] || '',
        time: new Date().toLocaleString('zh-CN')
    };

    const count = saveAccount(account);
    notify(
        '夸克网盘',
        `✅ 抓包成功（第 ${count} 个账号）`,
        `用户：${account.user}\n时间：${account.time}\n已保存，等待定时签到`
    );

    done({});
}

// ==================== HTTP 请求 ====================

function httpGet(url, headers) {
    return new Promise((resolve, reject) => {
        if (isQX) {
            $task.fetch({ url, headers }).then(
                r => resolve({ body: r.body, status: r.statusCode }),
                reject
            );
        } else {
            $httpClient.get({ url, headers }, (err, resp, body) => {
                if (err) reject(err);
                else resolve({ body, status: resp.status });
            });
        }
    });
}

function httpPost(url, body, headers) {
    return new Promise((resolve, reject) => {
        if (isQX) {
            $task.fetch({ url, method: 'POST', headers, body }).then(
                r => resolve({ body: r.body, status: r.statusCode }),
                reject
            );
        } else {
            $httpClient.post({ url, body, headers }, (err, resp, body) => {
                if (err) reject(err);
                else resolve({ body, status: resp.status });
            });
        }
    });
}

// ==================== 签到逻辑 ====================

function buildParams(acc) {
    return `pr=ucpro&fr=android&kps=${encodeURIComponent(acc.kps)}&sign=${encodeURIComponent(acc.sign || '')}&vcode=${encodeURIComponent(acc.vcode || '')}`;
}

function buildHeaders(acc) {
    return {
        'User-Agent': acc.ua || 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
        'Cookie': `kps=${acc.kps}`,
        'Content-Type': 'application/json'
    };
}

async function getInfo(acc) {
    const url = `https://drive-m.quark.cn/1/clouddrive/capacity/growth/info?${buildParams(acc)}`;
    const r = await httpGet(url, buildHeaders(acc));
    const data = JSON.parse(r.body);
    if (data.data) return data.data;
    throw new Error(data.message || '获取信息失败');
}

async function sign(acc) {
    const url = `https://drive-m.quark.cn/1/clouddrive/capacity/growth/sign?${buildParams(acc)}`;
    const body = JSON.stringify({ sign_cyclic: true });
    const r = await httpPost(url, body, buildHeaders(acc));
    const data = JSON.parse(r.body);
    if (data.data) return data.data.sign_daily_reward;
    throw new Error(data.message || '签到失败');
}

async function checkinAccount(acc, i) {
    let log = `\n📱 第${i + 1}个账号：${acc.user || '未知'}\n`;
    log += '─'.repeat(20) + '\n';

    try {
        const info = await getInfo(acc);
        const vip = info['88VIP'];

        log += `${vip ? '👑 88VIP' : '👤 普通用户'}\n`;
        log += `💾 总容量：${convertBytes(info.total_capacity)}\n`;

        if (info.cap_composition?.sign_reward) {
            log += `📈 签到累计：${convertBytes(info.cap_composition.sign_reward)}\n`;
        }

        const cs = info.cap_sign;
        if (cs.sign_daily) {
            log += `✅ 今日已签到 +${convertBytes(cs.sign_daily_reward)}\n`;
            log += `🔗 连签：${cs.sign_progress}/${cs.sign_target}`;
        } else {
            const reward = await sign(acc);
            log += `🎉 签到成功 +${convertBytes(reward)}\n`;
            log += `🔗 连签：${cs.sign_progress + 1}/${cs.sign_target}`;
        }

        return { ok: true, log };
    } catch (e) {
        log += `❌ 失败：${e.message}`;
        return { ok: false, log };
    }
}

async function checkin() {
    const list = getAccounts();

    if (list.length === 0) {
        notify('夸克网盘签到', '❌ 未找到账号', '请打开夸克网盘APP并开启重写');
        done();
        return;
    }

    console.log(`✅ 共 ${list.length} 个账号`);

    let allLog = '';
    let okCount = 0;

    for (let i = 0; i < list.length; i++) {
        const r = await checkinAccount(list[i], i);
        if (r.ok) okCount++;
        allLog += r.log + '\n';
    }

    const title = `夸克网盘签到 ${okCount}/${list.length}`;
    const sub = okCount === list.length ? '✅ 全部成功' : `⚠️ ${list.length - okCount} 个失败`;
    notify(title, sub, allLog.trim());

    done();
}

// ==================== 入口 ====================

if (typeof $request !== 'undefined' && $request) {
    // 抓包模式
    capture();
} else {
    // 签到模式
    checkin().catch(e => {
        notify('夸克网盘签到', '❌ 运行出错', e.message);
        done();
    });
}
