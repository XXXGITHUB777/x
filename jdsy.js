(function () {
    // 采用独立键值，避免和历史错误缓存冲突
    var K_REQ = "jdsy_req_v5";
    var K_SNAP = "jdsy_snap_v5";
    var K_FAIL = "jdsy_fail_v5";

    var isMitm = typeof $request !== "undefined" && typeof $response !== "undefined";

    if (isMitm) {
        runMitm();
    } else {
        runCron();
    }

    function runMitm() {
        var req = {
            url: $request.url,
            method: $request.method || "POST",
            headers: $request.headers || {},
            body: $request.body || ""
        };
        $persistentStore.write(JSON.stringify(req), K_REQ);
        $persistentStore.write("0", K_FAIL);

        var bodyObj;
        try {
            bodyObj = JSON.parse($response.body);
        } catch (e) {
            return $done({});
        }

        processData(bodyObj, true);
        $done({});
    }

    function runCron() {
        var reqStr = $persistentStore.read(K_REQ);
        if (!reqStr) {
            $notification.post("京东试用监控", "缺少请求参数", "请打开京东App->评价中心->试用列表");
            return $done();
        }

        var reqObj;
        try {
            reqObj = JSON.parse(reqStr);
        } catch (e) {
            return $done();
        }

        $task.fetch(reqObj).then(function (resp) {
            var bodyObj;
            try {
                bodyObj = JSON.parse(resp.body);
            } catch (e) {
                handleFail();
                return $done();
            }
            
            // 如果返回的数据不包含 result，通常意味着 sign 已过期
            if (!bodyObj || !bodyObj.result) {
                handleFail();
                return $done();
            }

            $persistentStore.write("0", K_FAIL);
            processData(bodyObj, false);
            $done();
        }, function (error) {
            handleFail();
            $done();
        });
    }

    function processData(data, isMitm) {
        if (!data || !data.result) return;
        var result = data.result;
        
        // 核心判断依据：totalClaimableNum > 0 且 trialActivities 数组非空
        var total = result.totalClaimableNum || 0;
        var acts = result.trialActivities || [];

        var oldSnapStr = $persistentStore.read(K_SNAP);
        var oldSnap = { total: 0, items: [] };
        if (oldSnapStr) {
            try {
                oldSnap = JSON.parse(oldSnapStr);
            } catch (e) {}
        }

        var newItems = [];
        var out = [];

        // 只有在有货的情况下才进行比对，售罄 (total=0 或 acts为空) 则静默
        if (total > 0 && acts.length > 0) {
            for (var i = 0; i < acts.length; i++) {
                var act = acts[i];
                var skuId = act.skuId || act.activityId || "未知";
                newItems.push(skuId);

                // 检查是否为新上架的商品 (旧快照中不存在此 SKU)
                if (oldSnap.items.indexOf(skuId) === -1) {
                    out.push("🆕 发现新试用商品 (SKU: " + skuId + ")");
                }
            }

            // 如果没有新商品，但总可申请名额增加了，也通知
            if (total > oldSnap.total && out.length === 0) {
                out.push("📈 可申请总名额增加: " + oldSnap.total + " -> " + total);
            }
        }

        if (out.length > 0) {
            $notification.post("京东试用 (可申" + total + "件)", "", out.join("\n"));
        } else if (isMitm && oldSnap.items.length === 0) {
            $notification.post("京东试用监控", "✅ 初始化成功", "已抓取H5版参数，开始自动监控");
        }

        // 保存新快照供下次比对
        $persistentStore.write(JSON.stringify({ total: total, items: newItems }), K_SNAP);
    }

    function handleFail() {
        var failCount = parseInt($persistentStore.read(K_FAIL) || "0", 10) + 1;
        $persistentStore.write(failCount.toString(), K_FAIL);

        // 避免通知轰炸，每 4 次连续失败提醒 1 次
        if (failCount === 1 || failCount % 4 === 1) {
            $notification.post("京东试用 ⚠️ 参数失效", "Sign可能已过期，请刷新", "请打开京东App->评价中心->试用列表，触发重新抓取");
        }
    }
})();
