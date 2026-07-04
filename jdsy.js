/**
 * @fileoverview 京东试用监控 (QX优化版)
 * * [mitm]
 * hostname = api.m.jd.com
 * * [rewrite_local]
 * ^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=getCommentOfficerTrialHome url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js
 * * [task_local]
 * */30 * * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD_Trial_Monitor, enable=true
 * event network-changed script-path=https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jdsy.js, tag=JD_Trial_Net, enable=true
 */

!(async () => {
    const K_REQ = "jd_trial_req";
    const K_SNAP = "jd_trial_snapshot";
    const K_FAIL = "jd_trial_fail";

    const isMitm = typeof $request !== "undefined" && $request.url.indexOf("getCommentOfficerTrialHome") > -1;

    if (isMitm) {
        handleMitm();
    } else {
        await handleCron();
    }

    // --- MITM 抓包逻辑 ---
    function handleMitm() {
        try {
            // 保存请求参数供定时任务使用
            const reqData = {
                url: $request.url,
                method: $request.method || "POST",
                headers: $request.headers,
                body: $request.body
            };
            $persistentStore.write(JSON.stringify(reqData), K_REQ);
            $persistentStore.write("0", K_FAIL); // 重置失败次数

            // 处理响应数据
            const body = JSON.parse($response.body);
            processData(body, true);
        } catch (e) {
            console.log("MITM处理异常: " + e);
        } finally {
            $done({}); // 释放请求
        }
    }

    // --- Cron 定时任务逻辑 ---
    async function handleCron() {
        const reqStr = $persistentStore.read(K_REQ);
        if (!reqStr) {
            $notification.post("京东试用监控", "⚠️ 缺乏请求参数", "请先打开 京东App -> 评价中心 -> 试用列表 获取配置");
            return $done();
        }

        let req;
        try {
            req = JSON.parse(reqStr);
        } catch (e) {
            return $done();
        }

        try {
            const resp = await new Promise((resolve, reject) => {
                $task.fetch(req).then(resolve, reject);
            });
            
            const body = JSON.parse(resp.body);
            // 校验京东返回的code，如果不为0通常是sign过期或非法
            if (body.code !== "0" && body.code !== 0) {
                throw new Error("Sign Expired");
            }
            
            $persistentStore.write("0", K_FAIL);
            processData(body, false);
        } catch (e) {
            handleExpired();
        } finally {
            $done();
        }
    }

    // --- 核心数据比对逻辑 ---
    function processData(data, isFromMitm) {
        if (!data.result || !data.result.trialActivities) return;
        
        const activities = data.result.trialActivities;
        const currentTotal = data.result.totalClaimableNum || (data.result.trialBar && data.result.trialBar.claimableNum) || 0;
        
        let newSnapshot = {};
        
        // 构建新快照字典 (key: activityId_skuId)
        activities.forEach(item => {
            const key = `${item.activityId || 'A'}_${item.skuId || 'S'}`;
            newSnapshot[key] = {
                name: item.skuName || item.activityName || `未知商品_${item.skuId}`,
                stock: item.claimableNum || 0
            };
        });

        // 读取旧快照
        const oldSnapshotStr = $persistentStore.read(K_SNAP);
        const oldSnapshot = oldSnapshotStr ? JSON.parse(oldSnapshotStr) : {};

        let out = [];

        // 比对差异
        for (const [key, newItem] of Object.entries(newSnapshot)) {
            // 需求：售罄（名额为0）静默不通知
            if (newItem.stock <= 0) continue;

            const oldItem = oldSnapshot[key];
            if (!oldItem) {
                // 新出现的商品
                out.push(`🆕 ${newItem.name} (余 ${newItem.stock} 件)`);
            } else if (newItem.stock > oldItem.stock) {
                // 已有商品，且名额增加
                out.push(`📈 ${newItem.name} (名额: ${oldItem.stock} -> ${newItem.stock})`);
            }
        }

        // 组装通知
        if (out.length > 0) {
            const title = `京东试用上新 (可申请 ${currentTotal} 件)`;
            const body = out.slice(0, 8).join("\n") + (out.length > 8 ? `\n...等共 ${out.length} 条更新` : "");
            $notification.post(title, "", body);
        } else if (isFromMitm && Object.keys(oldSnapshot).length === 0) {
            $notification.post("京东试用监控", "✅ 初始化成功", "已成功抓取列表，开始自动监控");
        }

        // 保存新快照
        $persistentStore.write(JSON.stringify(newSnapshot), K_SNAP);
    }

    // --- 签名过期处理 ---
    function handleExpired() {
        let fails = parseInt($persistentStore.read(K_FAIL) || "0", 10) + 1;
        $persistentStore.write(fails.toString(), K_FAIL);
        
        // 阶梯式通知，避免轰炸 (第1次，第5次，第9次...通知)
        if (fails === 1 || fails % 4 === 1) {
            $notification.post(
                "京东试用 ⚠️ 签名失效", 
                "请求已过期，请重新获取", 
                "请打开 京东App -> 评价中心 -> 试用列表 刷新参数。"
            );
        }
    }
})();
