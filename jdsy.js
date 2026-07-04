/*
 * 京东试用监控 v2 · 单脚本终极版
 * ──────────────────────────────────────────────
 *
 * 复用逻辑：
 *   MITM 被动拦截 → 存请求 (+ 比对通知)
 *   每 30 分钟 cron → 用缓存请求主动拉取 → 比对通知
 *   签名过期 → 通知你开 App，进去后自动恢复
 *
 * QX 配置（三行搞定）：
 *   hostname = api.m.jd.com
 *
 *   [rewrite_local]
 *   ^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/你/仓库名/main/jd_trial.js
 *
 *   [task_local]
 *   */30 * * * * tag=京东试用监控, script-path=https://raw.githubusercontent.com/你/仓库名/main/jd_trial.js, enabled=true
 */

(function () {
  'use strict';

  const MATCH_URL = 'functionId=getCommentOfficerTrialHome';
  const API_URL = 'https://api.m.jd.com/client.action?functionId=getCommentOfficerTrialHome';

  // ── 持久化 Key ──────────────────────────────
  const K = {
    snap: 'jdt_snap',       // 商品快照
    req:  'jdt_req',        // 完整请求（给 cron 用）
    failJ: 'jdt_fail',      // 连续过期次数
    needJ: 'jdt_need',      // 1=等用户手动刷
  };

  // ── 模式分支 ──────────────────────────────
  if ($response && $request && ($request.url || '').includes(MATCH_URL)) runMitm();
  else runCron();

  /* ══════════════════════════════════════════════════════════════
   * 模式 A：MITM 被动拦截
   *   用户打开 JD App → 评价中心 → 试用列表 → 触发
   *   存请求 + 解析 + 比对
   * ══════════════════════════════════════════════════════════════ */
  function runMitm() {
    const obj = safeJson($response.body);
    if (!obj || !obj.result) return $done({});

    const r = obj.result;
    const total = r.totalClaimableNum
      || (r.trialBar && r.trialBar.claimableNum) || 0;
    const acts = r.trialActivities || [];

    const snap = {
      total,
      ts: Date.now(),
      items: acts.map(a => ({
        k: a.activityId + '_' + a.skuId,
        aid: a.activityId,
        sku: a.skuId,
        name: a.skuName || a.activityName || ('SKU:' + a.skuId),
        stock: a.claimableNum || 0,
      })),
    };

    // ★ 存完整请求 cron 用
    save(K.req, {
      url: $request.url,
      method: 'POST',
      headers: $request.headers,
      body: $request.body,
    });

    // 清理过气标志
    $persistentStore.write('0', K.failJ);
    $persistentStore.write('0', K.needJ);

    const prev = load(K.snap);
    const notices = diff(prev, snap);

    if (notices.length) notify(snap.total, notices);

    // 恢复后补一条提示
    if ((!notices.length) && prev && prev.total === 0 && snap.total > 0) {
      notify(snap.total, ['当前可申请 ' + snap.total + ' 件']);
    }

    save(K.snap, snap);
    $done({});
  }

  /* ══════════════════════════════════════════════════════════════
   * 模式 B：cron 定时（默认每 30 分钟）
   *   用 MITM 存下的请求原样重放
   * ══════════════════════════════════════════════════════════════ */
  function runCron() {
    const req = load(K.req);

    if (!req) {
      notifyP('京东试用', '初始化', '打开 App → 评价中心 → 试用列表，脚本自动抓取');
      return $done({});
    }

    $task.fetch(req).then(resp => {
      const obj = safeJson(resp.body);
      if (!obj || !obj.result) return expired();

      const r = obj.result;
      const total = r.totalClaimableNum
        || (r.trialBar && r.trialBar.claimableNum) || 0;
      const acts = r.trialActivities || [];

      const snap = {
        total,
        ts: Date.now(),
        items: acts.map(a => ({
          k: a.activityId + '_' + a.skuId,
          aid: a.activityId,
          sku: a.skuId,
          name: a.skuName || a.activityName || ('SKU:' + a.skuId),
          stock: a.claimableNum || 0,
        })),
      };

      // 缓存清掉过期标志
      $persistentStore.write('0', K.failJ);
      $persistentStore.write('0', K.needJ);

      const prev = load(K.snap);
      const notices = diff(prev, snap);

      if (notices.length) notify(snap.total, notices);

      save(K.snap, snap);
      console.log(`[Cron ✓] total=${total} diff=${notices.length}`);

    }).catch(err => {
      console.log('[Cron ×] ' + err.message);
      expired();
    }).finally(() => $done({}));
  }

  /* ══════════════════════════════════════════════════════════════
   * 过期处理（签名失效）
   * ══════════════════════════════════════════════════════════════ */
  function expired() {
    const cnt = parseInt($persistentStore.read(K.failJ) || '0', 10) + 1;
    $persistentStore.write(String(cnt), K.failJ);
    $persistentStore.write('1', K.needJ);

    // 第 1 次即时通知，之后每 4 次（~2 小时）再提醒
    if (cnt > 1 && (cnt & 3) !== 0) return;

    const snap = load(K.snap);
    const last = snap ? new Date(snap.ts).toLocaleTimeString('zh-CN') : '未知';
    const ago = snap ? Math.floor((Date.now() - snap.ts) / 60000) : 0;
    const tail = snap ? `\n最后一次：${last}（${ago} 分钟前，共 ${snap.total} 件）`
      : '（暂无历史数据）';

    notifyP('京东试用', '签名过期，请刷新', '打开 App → 评价中心 → 试用列表' + tail);
  }

  /* ══════════════════════════════════════════════════════════════
   * 核心：快照对比 → 返回通知文本行
   *  只关注「新增」和「库存涨」，售光不报
   * ══════════════════════════════════════════════════════════════ */
  function diff(prev, curr) {
    if (!prev) return [];                  // 首次启动静默
    const out = [];

    // 总可申请数增加
    if (curr.total > prev.total) {
      out.push(`▶ 可申请 +${curr.total - prev.total}（${prev.total} → ${curr.total}）`);
    }

    // 建 key 索引
    const prevMap = {};
    prev.items.forEach(it => prevMap[it.k] = it);

    // 逐条比对：新增 / 库存涨
    curr.items.forEach(it => {
      if (!prevMap[it.k]) {
        out.push(`🆕 ${it.name}${it.stock ? ' · 余' + it.stock : ''}`);
      } else if (it.stock > prevMap[it.k].stock) {
        out.push(`📈 ${it.name}：${prevMap[it.k].stock} → ${it.stock}`);
      }
    });

    // 售光不报（即 prev 有但 curr 没有的，直接忽略）

    return out;
  }

  /* ══════════════════════════════════════════════════════════════
   * 通知
   * ══════════════════════════════════════════════════════════════ */
  function notify(total, lines) {
    // 最多显示 5 条，超出汇总
    const n = lines.length;
    const head = lines.slice(0, 5).join('\n');
    const body = n > 5 ? head + `\n…共 ${n} 条更新` : head;
    $notification.post(`京东试用 · 可申请 ${total} 件`, '', body);
  }

  function notifyP(title, sub, body) {
    $notification.post(title, sub || '', body);
  }

  /* ══════════════════════════════════════════════════════════════
   * 工具
   * ══════════════════════════════════════════════════════════════ */
  function safeJson(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function save(k, v) {
    $persistentStore.write(JSON.stringify(v), k);
  }

  function load(k) {
    try {
      const v = $persistentStore.read(k);
      return v ? JSON.parse(v) : null;
    } catch (_) { return null; }
  }
})();
