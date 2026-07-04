/**********************************************
 * 京东试用监控 · 单脚本版 v3
 * 
 * 功能：每 30 分钟自动拉取试用列表，
 *       新增商品即时通知，售光不报。
 *
 * QX 配置：
 *   [mitm]
 *   hostname = api.m.jd.com
 *   
 *   [rewrite_local]
 *   ^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js
 *   
 *   [task_local]
 *   */30 * * * * tag=JD_TRIAL_MONITOR, script-path=https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, enabled=true
 **********************************************/

(function () {
  "use strict";

  const MATCH_URL = "functionId=getCommentOfficerTrialHome";
  const API_URL = "https://api.m.jd.com/client.action?functionId=getCommentOfficerTrialHome";

  // 持久化 key
  const K = {
    snap: "jdt_snap",
    req: "jdt_req",
    failJ: "jdt_fail",
    needJ: "jdt_need",
  };

  // 全局变量（MITM 模式赋值，cron 模式 null）
  let respBody = null;
  let reqUrl = null;
  let reqHeaders = null;
  let reqBody = null;

  const isMitm = typeof $response !== "undefined" && $request && ($request.url || "").indexOf(MATCH_URL) > -1;

  if (isMitm) {
    respBody = $response.body;
    reqUrl = $request.url;
    reqHeaders = $request.headers;
    reqBody = $request.body;
    runMitm();
  } else {
    runCron();
  }

  // ── 模式 A：MITM ────────────────────────────
  function runMitm() {
    const obj = safeJson(respBody);
    if (!obj || !obj.result) return $done({});

    const r = obj.result;
    const total = r.totalClaimableNum || (r.trialBar && r.trialBar.claimableNum) || 0;
    const acts = r.trialActivities || [];

    // 存请求供 cron 使用
    save(K.req, {
      url: reqUrl,
      method: "POST",
      headers: reqHeaders,
      body: reqBody,
    });

    // 清标志
    write(K.failJ, "0");
    write(K.needJ, "0");

    const currSnap = buildSnap(total, acts);
    const prev = load(K.snap);
    const diff = diffSnap(prev, currSnap);

    if (diff.length > 0) {
      doNotify(currSnap.total, diff);
    }

    save(K.snap, currSnap);
    console.log("[MITM] total=" + total + " items=" + currSnap.items.length + " diff=" + diff.length);
    $done({});
  }

  // ── 模式 B：cron ────────────────────────────
  function runCron() {
    const req = load(K.req);
    if (!req) {
      doNotifyP("京东试用", "初始化", "打开 App → 评价中心 → 试用列表，首次获取请求数据");
      return $done({});
    }

    $task.fetch(req).then(function (resp) {
      const obj = safeJson(resp.body);
      if (!obj || !obj.result) return expired();

      const r = obj.result;
      const total = r.totalClaimableNum || (r.trialBar && r.trialBar.claimableNum) || 0;
      const acts = r.trialActivities || [];

      write(K.failJ, "0");
      write(K.needJ, "0");

      const currSnap = buildSnap(total, acts);
      const prev = load(K.snap);
      const diff = diffSnap(prev, currSnap);

      if (diff.length > 0) {
        doNotify(currSnap.total, diff);
      }

      save(K.snap, currSnap);
      console.log("[Cron] total=" + total + " diff=" + diff.length);
    }).catch(function (err) {
      console.log("[Cron] fail: " + err.message);
      expired();
    }).finally(function () {
      $done({});
    });
  }

  // ── 过期处理 ───────────────────────────────
  function expired() {
    const prevFail = parseInt(read(K.failJ) || "0", 10);
    const newFail = prevFail + 1;
    write(K.failJ, String(newFail));
    write(K.needJ, "1");

    // 首次立即通知，之后每 4 轮（~2 小时）提醒
    if (newFail > 1 && (newFail & 3) !== 0) return;

    const snap = load(K.snap);
    let tail = "暂无数据";
    if (snap) {
      const last = new Date(snap.ts).toLocaleTimeString("zh-CN");
      const ago = Math.floor((Date.now() - snap.ts) / 60000);
      tail = "\n\n最后一次：" + last + "（" + ago + " 分钟前）\n共 " + snap.total + " 件";
    }

    doNotifyP("京东试用", "签名过期，请刷新",
      "操作：打开 App → 评价中心 → 试用列表，脚本自动恢复" + tail);
  }

  // ── 快照构建 ───────────────────────────────
  function buildSnap(total, acts) {
    return {
      total: total,
      ts: Date.now(),
      items: acts.map(function (a) {
        return {
          k: a.activityId + "_" + a.skuId,
          name: a.skuName || a.activityName || ("SKU:" + a.skuId),
          stock: a.claimableNum || 0,
        };
      }),
    };
  }

  // ── 核心比对 ───────────────────────────────
  function diffSnap(prev, curr) {
    if (!prev) return [];
    const out = [];

    if (curr.total > prev.total) {
      out.push("▶ 可申请 +" + (curr.total - prev.total) + "（" + prev.total + "→" + curr.total + "）");
    }

    const map = {};
    prev.items.forEach(function (it) {
      map[it.k] = it;
    });

    curr.items.forEach(function (it) {
      if (!map[it.k]) {
        // 新增商品
        let line = "🆕 " + it.name;
        if (it.stock > 0) line += " · 余 " + it.stock + " 件";
        out.push(line);
      } else if (it.stock > map[it.k].stock) {
        // 库存增加
        out.push("📈 " + it.name + "：" + map[it.k].stock + "→" + it.stock);
      }
    });

    return out;
  }

  // ── 通知封装 ───────────────────────────────
  function doNotify(total, lines) {
    const shown = lines.slice(0, 5);
    let body = shown.join("\n");
    if (lines.length > 5) body += "\n…共 " + lines.length + " 条更新";
    $notification.post("京东试用 · 可申请 " + total + " 件", "", body);
  }

  function doNotifyP(title, sub, body) {
    $notification.post(title, sub || "", body);
  }

  // ── 持久化工具 ─────────────────────────────
  function read(key) {
    return $persistentStore.read(key);
  }

  function write(key, value) {
    $persistentStore.write(value, key);
  }

  function save(key, obj) {
    $persistentStore.write(JSON.stringify(obj), key);
  }

  function load(key) {
    try {
      const v = $persistentStore.read(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }

  function safeJson(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

})();
