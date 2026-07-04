/*
京东试用监控 v5 - Quantumult X 版
功能：MITM 自动抓存 + cron 定时主动拉取 + 新增商品自动通知
一个脚本搞定，上传 GitHub 直接远程引用

==================== QX 配置 ====================

[rewrite_local]
^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js

[mitm]
hostname = api.m.jd.com

[task_local]
*/30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用监控, enable=true

【使用方法】
1. 开启 MitM 和脚本重写
2. 打开京东 App → 评价中心 → 试用列表
3. 脚本自动抓取请求并监控
4. 有新品上架自动推送通知

============================================================
*/

(function () {
  "use strict";

  const MATCH_URL = "functionId=getCommentOfficerTrialHome";
  const K_SNAP = "jdt_snap";
  const K_REQ = "jdt_req";
  const K_FAIL = "jdt_fail";

  let isMitm = false;
  try {
    if (typeof $response !== "undefined" && $request && ($request.url || "").indexOf(MATCH_URL) > -1) {
      isMitm = true;
    }
  } catch (e) {}

  if (isMitm) {
    runMitm();
  } else {
    runCron();
  }

  function runMitm() {
    let obj;
    try { obj = JSON.parse($response.body); } catch (e) {}
    if (!obj || !obj.result) return $done({});

    let r = obj.result;
    let total = r.totalClaimableNum || (r.trialBar && r.trialBar.claimableNum) || 0;
    let acts = r.trialActivities || [];

    try {
      $persistentStore.write(JSON.stringify({
        url: $request.url || "",
        method: "POST",
        headers: $request.headers || {},
        body: $request.body || ""
      }), K_REQ);
    } catch (e) {}

    $persistentStore.write("0", K_FAIL);

    let currSnap = makeSnap(total, acts);
    let prevSnap = loadSnap();
    let diff = diffSnap(prevSnap, currSnap);

    if (diff.length > 0) {
      let body = diff.slice(0, 5).join("\n");
      if (diff.length > 5) body += "\n...共 " + diff.length + " 条";
      $notification.post("京东试用 · 可申请 " + total + " 件", "", body);
    }

    try {
      $persistentStore.write(JSON.stringify(currSnap), K_SNAP);
    } catch (e) {}

    $done({});
  }

  function runCron() {
    let reqStr = $persistentStore.read(K_REQ);
    if (!reqStr) {
      $notification.post("京东试用", "初始化",
        "打开京东App → 评价中心 → 试用列表\n脚本将自动抓取并监控");
      return $done({});
    }

    let req;
    try { req = JSON.parse(reqStr); } catch (e) { return $done({}); }

    $task.fetch({
      url: req.url || "",
      method: "POST",
      headers: req.headers || {},
      body: req.body || ""
    }).then(function (resp) {
      let obj;
      try { obj = JSON.parse(resp.body); } catch (e) { return expired(); }
      if (!obj || !obj.result) return expired();

      let r = obj.result;
      let total = r.totalClaimableNum || (r.trialBar && r.trialBar.claimableNum) || 0;
      let acts = r.trialActivities || [];

      $persistentStore.write("0", K_FAIL);

      let currSnap = makeSnap(total, acts);
      let prevSnap = loadSnap();
      let diff = diffSnap(prevSnap, currSnap);

      if (diff.length > 0) {
        let body = diff.slice(0, 5).join("\n");
        if (diff.length > 5) body += "\n...共 " + diff.length + " 条";
        $notification.post("京东试用 · 可申请 " + total + " 件", "", body);
      }

      $persistentStore.write(JSON.stringify(currSnap), K_SNAP);

    }).catch(function (err) {
      expired();
    }).finally(function () {
      $done({});
    });
  }

  function expired() {
    let prev = parseInt($persistentStore.read(K_FAIL) || "0", 10) + 1;
    $persistentStore.write(String(prev), K_FAIL);

    if (prev > 1 && prev % 4 !== 1) return;

    let snap = loadSnap();
    let msg = "打开京东App → 评价中心 → 试用列表";
    if (snap) {
      let last = new Date(snap.ts);
      let hh = last.getHours();
      let mm = last.getMinutes();
      mm = mm < 10 ? "0" + mm : "" + mm;
      let ago = Math.floor((Date.now() - snap.ts) / 60000);
      msg += "\n\n上次：" + hh + ":" + mm + "（" + ago + " 分钟前）\n共 " + snap.total + " 件";
    }
    $notification.post("京东试用", "签名过期，请刷新", msg);
  }

  function makeSnap(total, acts) {
    let items = [];
    for (let i = 0; i < acts.length; i++) {
      let a = acts[i];
      items.push({
        k: (a.activityId || "") + "_" + (a.skuId || ""),
        n: a.skuName || a.activityName || ("SKU" + (a.skuId || "")),
        s: a.claimableNum || 0
      });
    }
    return { t: total, ts: Date.now(), items: items };
  }

  function diffSnap(prev, curr) {
    if (!prev || !prev.items) return [];
    let out = [];

    if (curr.t > prev.t) {
      out.push("▶ 可申请 +" + (curr.t - prev.t) + "（" + prev.t + "→" + curr.t + "）");
    }

    let map = {};
    for (let i = 0; i < prev.items.length; i++) {
      map[prev.items[i].k] = prev.items[i];
    }

    for (let i = 0; i < curr.items.length; i++) {
      let it = curr.items[i];
      if (!map[it.k]) {
        let line = "🆕 " + it.n;
        if (it.s > 0) line += " · 余 " + it.s + " 件";
        out.push(line);
      } else if (it.s > map[it.k].s) {
        out.push("📈 " + it.n + "：" + map[it.k].s + "→" + it.s);
      }
    }

    return out;
  }

  function loadSnap() {
    try {
      let v = $persistentStore.read(K_SNAP);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }

})();
