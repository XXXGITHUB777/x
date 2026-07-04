// [mitm]
// hostname = api.m.jd.com
//
// [rewrite_local]
// ^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js
//
// [task_local]
// */30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用监控, enable=true
// event network-changed script-path=https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD试用网络触发, enable=true

(function () {
    const K_REQ = "jdsy_req_v6";
    const K_SNAP = "jdsy_snap_v6";
    const K_FAIL = "jdsy_fail_v6";

    // 判断是抓包触发还是定时任务触发
    const isMitm = typeof $request !== "undefined";

    if (isMitm) {
        runMitm();
    } else {
        runCron();
    }

    function runMitm() {
        // 保存最新的请求参数，供定时任务重放
        const req = {
            url: $request.url,
            method: $request.method || "POST",
            headers: $request.headers || {},
            body: $request.body || ""
        };
        $persistentStore.write(JSON.stringify(req), K_REQ);
        $persistentStore.write("0", K_FAIL);

        try {
            const bodyObj = JSON.parse($response.body);
            processData(bodyObj, true);
        } catch (e) {
            console.log("解析响应失败: " + e);
        }
        $done({});
    }

    function runCron() {
        const reqStr = $persistentStore.read(K_REQ);
        if (!reqStr) {
            $notification.post("京东试用监控", "⚠️ 缺少请求参数", "请打开京东App->评价中心->试用列表触发抓包");
            return $done();
        }

        const reqObj = JSON.parse(reqStr);
        $task.fetch(reqObj).then(resp => {
            try {
                const bodyObj = JSON.parse(resp.body);
                // 校验接口是否返回了有效的 result，防止 sign 失效返回空
                if (bodyObj && bodyObj.result) {
                    $persistentStore.write("0", K_FAIL);
                    processData(bodyObj, false);
                } else {
                    handleFail();
                }
            } catch (e) {
                handleFail();
            }
            $done();
        }, err => {
            handleFail();
            $done();
        });
    }

    function processData(data, isMitm) {
        if (!data || !data.result) return;
        const result = data.result;

        const total = result.totalClaimableNum || 0;
        const acts = result.trialActivities || [];

        // 售光了 (静默不通知，只更新快照清零)
        if (total === 0 || acts.length === 0) {
            $persistentStore.write(JSON.stringify({ total: 0, items: [] }), K_SNAP);
            return;
        }

        const oldSnapStr = $persistentStore.read(K_SNAP);
        const oldSnap = oldSnapStr ? JSON.parse(oldSnapStr) : { total: 0, items: [] };
        
        let newItemsIds = [];
        let newItemsMap = {};
        
        acts.forEach(act => {
            const id = act.skuId || act.activityId;
            newItemsIds.push(id);
            newItemsMap[id] = act;
        });

        let out = [];

        // 1. 只要出现 NEW 商品就通知
        newItemsIds.forEach(id => {
            if (oldSnap.items.indexOf(id) === -1) {
                const name = newItemsMap[id].skuName ? newItemsMap[id].skuName : ("SKU: " + id);
                out.push("🆕 发现新试用: " + name);
            }
        });

        // 2. 同时勾选「可申请数量增加」也通知
        if (total > oldSnap.total) {
            out.push("📈 可申请总名额增加: " + oldSnap.total + " -> " + total);
        }

        // 推送通知
        if (out.length > 0) {
            $notification.post("京东试用更新 (可申" + total + "件)", "", out.join("\n"));
        } else if (isMitm && oldSnap.items.length === 0) {
            $notification.post("京东试用监控", "✅ 初始化成功", "已成功抓取H5版参数，开始自动监控");
        }

        // 覆写快照供下次比对
        $persistentStore.write(JSON.stringify({ total: total, items: newItemsIds }), K_SNAP);
    }

    function handleFail() {
        let failCount = parseInt($persistentStore.read(K_FAIL) || "0", 10) + 1;
        $persistentStore.write(failCount.toString(), K_FAIL);

        // 连续失败，阶梯式提醒，防打扰
        if (failCount === 1 || failCount % 4 === 1) {
            $notification.post(
                "京东试用 ⚠️ Sign过期", 
                "后台请求参数已失效", 
                "请重新打开京东App->评价中心->试用列表触发更新"
            );
        }
    }
})();
