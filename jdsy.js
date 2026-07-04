// 京东试用监控 - 终极自检版
// 纯净单行注释，绝不触发 QX 解析 Bug

(function () {
    var K_REQ = "jdsy_req_v8";
    var K_SNAP = "jdsy_snap_v8";
    var K_FAIL = "jdsy_fail_v8";

    var isReq = typeof $request !== "undefined";
    var isResp = typeof $response !== "undefined";

    if (isReq && isResp) {
        // 模式1：Rewrite 抓包模式
        runMitm();
    } else {
        // 模式2：Task 定时任务或手动运行模式
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

        try {
            var bodyObj = JSON.parse($response.body);
            processData(bodyObj, true);
        } catch (e) {
            console.log("解析响应体失败: " + e);
            $done({});
        }
    }

    function runCron() {
        var reqStr = $persistentStore.read(K_REQ);
        if (!reqStr) {
            // 如果你在 QX 定时任务列表里手动点“运行”，会立刻弹出这个，证明脚本加载成功了，只是没抓到包
            $notification.post("京东试用监控自检", "❌ 尚未抓取到数据", "请去京东App -> 评价中心 -> 试用列表【下拉刷新】一次！");
            $done();
            return;
        }

        var reqObj;
        try {
            reqObj = JSON.parse(reqStr);
        } catch (e) {
            $done();
            return;
        }

        $task.fetch(reqObj).then(function(resp) {
            try {
                var bodyObj = JSON.parse(resp.body);
                if (bodyObj && bodyObj.result) {
                    $persistentStore.write("0", K_FAIL);
                    processData(bodyObj, false);
                } else {
                    handleFail("接口返回异常，Sign可能过期");
                }
            } catch (e) {
                handleFail("数据解析报错");
            }
        }, function(err) {
            handleFail("网络请求彻底失败");
        });
    }

    function processData(data, isFromMitm) {
        if (!data || !data.result) {
            $done({});
            return;
        }
        var result = data.result;
        var total = result.totalClaimableNum || 0;
        var acts = result.trialActivities || [];

        if (total === 0 || acts.length === 0) {
            $persistentStore.write(JSON.stringify({ total: 0, items: [] }), K_SNAP);
            $done({});
            return;
        }

        var oldSnapStr = $persistentStore.read(K_SNAP);
        var oldSnap = oldSnapStr ? JSON.parse(oldSnapStr) : { total: 0, items: [] };
        
        var newItemsIds = [];
        var newItemsMap = {};
        
        for (var i = 0; i < acts.length; i++) {
            var act = acts[i];
            var id = act.skuId || act.activityId || String(i);
            newItemsIds.push(id);
            newItemsMap[id] = act;
        }

        var outMsgs = [];

        for (var j = 0; j < newItemsIds.length; j++) {
            var curId = newItemsIds[j];
            if (oldSnap.items.indexOf(curId) === -1) {
                var name = newItemsMap[curId].skuName || ("商品ID: " + curId);
                outMsgs.push("🆕 " + name);
            }
        }

        if (total > oldSnap.total) {
            outMsgs.push("📈 名额增加: " + oldSnap.total + " -> " + total);
        }

        if (outMsgs.length > 0) {
            $notification.post("京东试用 (可申" + total + "件)", "", outMsgs.join("\n"));
        } else if (isFromMitm) {
            // 抓包成功时立刻弹窗，让你明确知道抓到了！
            $notification.post("京东试用监控自检", "✅ 抓包成功！", "快照已建立，当前可申请 " + total + " 件。脚本将开始自动轮询。");
        }

        $persistentStore.write(JSON.stringify({ total: total, items: newItemsIds }), K_SNAP);
        $done({});
    }

    function handleFail(reason) {
        var failCount = parseInt($persistentStore.read(K_FAIL) || "0", 10) + 1;
        $persistentStore.write(failCount.toString(), K_FAIL);
        if (failCount === 1 || failCount % 4 === 1) {
            $notification.post("京东试用 ⚠️ 失效", reason, "请重新进入京东App -> 试用列表 -> 下拉刷新");
        }
        $done();
    }
})();
