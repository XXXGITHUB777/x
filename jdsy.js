/**
 * 京东试用监控 v3 · Quantumult X
 * 
 * 功能说明：
 * ① 被动拦截：打开京东App → 评价中心 → 试用列表时，自动记录请求
 * ② 定时轮询：每30分钟自动用缓存的请求查一次库存
 * ③ 智能通知：只在商品新增/库存涨价时推通知，无变化不打扰
 * ④ 过期提醒：签名失效后自动提醒你刷新App
 * 
 * ─────────────────────────────────────────────
 * QX 配置（添加到你配置文件的对应段落）：
 *
 * [mitm]
 * hostname = api.m.jd.com
 *
 * [rewrite_local]
 * ^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js
 *
 * [task_local]
 * */30 * * * * tag=京东试用监控, script-path=https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, enabled=true
 */

const FN = 'getCommentOfficerTrialHome';

// 持久化存储 Key
const kReq  = 'jd_trial_req';    // 完整请求（cron 用）
const kSnap = 'jd_trial_snap';   // 商品快照
const kFail = 'jd_trial_fail';   // 签名过期次数

// ─────────────── 工具函数 ───────────────
function parse(s)  { try { return JSON.parse(s); } catch (e) { return null; } }
function read(k)   { try { const v = $persistentStore.read(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function write(k,v) { $persistentStore.write(JSON.stringify(v), k); }

// 从响应中提取快照
function toSnap(obj) {
  if (!obj || !obj.result) return null;
  const r = obj.result;
  const total = r.totalClaimableNum ||
                (r.trialBar && r.trialBar.claimableNum) || 0;
  const acts = r.trialActivities || [];
  return {
    total: total,
    ts:   Date.now(),
    items: acts.map(function (a) {
      return {
        k:     a.activityId + '_' + a.skuId,
        name:  (a.skuName || a.activityName || '商品').substring(0, 40),
        stock: a.claimableNum || 0,
      };
    }),
  };
}

// 对比快照，只返回「新增」和「库存涨」
function diffSnap(prev, curr) {
  if (!prev) return [];               // 首次启动静默
  const out = [];
  if (curr.total > prev.total) {
    out.push('▶ 可申请数 ' + prev.total + ' → ' + curr.total);
  }
  const m = {};
  prev.items.forEach(function (it) { m[it.k] = it; });
  curr.items.forEach(function (it) {
    if (!m[it.k]) {
      out.push('🆕 ' + it.name + (it.stock ? ' · 余' + it.stock : ''));
    } else if (it.stock > m[it.k].stock) {
      out.push('📈 ' + it.name + '：' + m[it.k].stock + ' → ' + it.stock);
    }
  });
  return out;                          // 售光不报
}

// 推送通知（最多5条，超出汇总）
function doNotify(snap, diffs) {
  let body = diffs.slice(0, 5).join('\n');
  if (diffs.length > 5) body += '\n…共 ' + diffs.length + ' 条更新';
  $notification.post('📦 试用官 · ' + snap.total + ' 件可领', '', body);
}

// ─────────────── 主入口 ───────────────
const isMitm = $response && $request &&
               ($request.url || '').indexOf(FN) >= 0;

if (isMitm) {
  // ══ 模式A：MITM 被动拦截（用户打开试用列表触发）══

  const obj = parse($response.body);
  if (!obj || !obj.result) { $done({}); throw 'done'; }

  const snap = toSnap(obj);
  if (!snap) { $done({}); throw 'done'; }

  // ★ 保存完整请求（含 cookie / h5st / body）供 cron 使用
  if ($request.body && $request.headers) {
    write(kReq, {
      url:     $request.url,
      method:  'POST',
      headers: $request.headers,
      body:    $request.body,
    });
    $persistentStore.write('0', kFail);        // 清除过期计数
  }

  // 比对 → 通知
  const prev  = read(kSnap);
  const diffs = diffSnap(prev, snap);
  if (diffs.length > 0) doNotify(snap, diffs);

  write(kSnap, snap);
  $done({});

} else {
  // ══ 模式B：cron 定时（每30分钟）══

  const req = read(kReq);
  if (!req) {
    // 还没拦截过，提醒用户手动做第一次
    $notification.post('试用官监控', '待初始化',
      '打开京东App → 评价中心 → 试用列表，脚本将自动抓取请求');
    $done({});
    throw 'done';
  }

  $task.fetch(req).then(function (resp) {
    const obj = parse(resp.body);

    if (!obj || !obj.result) {
      // ── 签名过期 ──
      const cnt = parseInt($persistentStore.read(kFail) || '0', 10) + 1;
      $persistentStore.write(String(cnt), kFail);
      // 第1次即时提醒，之后每4次（~2h）再提醒
      if (cnt === 1 || cnt % 4 === 0) {
        const ps  = read(kSnap);
        const ago = ps ? Math.floor((Date.now() - ps.ts) / 60000) : 0;
        const last = ps ? new Date(ps.ts).toLocaleTimeString('zh-CN') : '未知';
        $notification.post('试用官监控',
          '签名已过期，请刷新',
          '打开App → 评价中心 → 试用列表\n' +
          '最后记录：' + last + '（' + ago + '分钟前，' +
          (ps ? ps.total : 0) + '件）');
      }
      $done({});
      return;
    }

    // ── 签名正常 ──
    const snap = toSnap(obj);
    if (!snap) { $done({}); return; }

    $persistentStore.write('0', kFail);        // 清除过期计数

    const prev  = read(kSnap);
    const diffs = diffSnap(prev, snap);
    if (diffs.length > 0) doNotify(snap, diffs);

    write(kSnap, snap);
    $done({});

  }).catch(function (err) {
    console.log('[JD Trial] fetch error: ' + err.message);
    $done({});
  });
}
