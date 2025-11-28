[rewrite_local]
# 用于首次获取Cookie，成功后务必在此行前加 # 将其注释掉
^https:\/\/activity\.10010\.com\/sixPalaceGridTurntableLottery\/signin\/daySign url script-request-header china_unicom_integrated.js

[task_local]
# 每天上午9点05分执行签到，时间可自定义
5 9 * * * china_unicom_integrated.js, tag=中国联通-自动签到, enabled=true



[mitm]
hostname = activity.10010.com

/*
 * @name: 中国联通签到（集成版）
 * @description: 脚本集成Cookie获取与每日自动签到功能。
 * @author: Gemini Business
 * @version: 1.0
 *
 * 首次使用步骤:
 * 1. 在[rewrite_local]中添加重写规则，并启用。
 * 2. 在[mitm]中添加`activity.10010.com`主机名。
 * 3. 打开中国联通App，手动签到一次。
 * 4. 收到“Cookie获取成功”通知后，禁用或注释掉重写规则。
 * 5. 脚本将按[task_local]设定的时间自动执行签到。
 */

const isQuantumultX = typeof $task !== 'undefined';
const isRequest = typeof $request !== 'undefined';

const scriptName = "中国联通签到";
const cookieKey = "chinaUnicomCookie_v2"; // 使用新key避免与旧脚本冲突
const signinUrl = "https://activity.10010.com/sixPalaceGridTurntableLottery/signin/daySign";

// =========== 主逻辑分发 ===========

(async () => {
  if (isRequest) {
    // 如果是请求上下文（重写规则触发），执行Cookie获取逻辑
    getCookie();
  } else {
    // 否则，执行定时签到逻辑
    await daySign();
  }
})().finally(() => {
  // 确保脚本在所有情况下都能正常结束
  $done();
});


// =========== 功能函数 ===========

/**
 * 获取Cookie的函数 (由重写规则触发)
 */
function getCookie() {
  if ($request.method === 'POST' && $request.url.includes(signinUrl)) {
    const cookieValue = $request.headers['Cookie'];
    if (cookieValue) {
      $prefs.setValueForKey(cookieValue, cookieKey);
      console.log(`[${scriptName}] 成功获取Cookie`);
      $notify(scriptName, "✅ Cookie获取成功", "现在可以禁用或注释掉此重写规则了");
    } else {
      console.log(`[${scriptName}] 获取Cookie失败，请求头中未找到Cookie`);
      $notify(scriptName, "❌ Cookie获取失败", "请求头中未找到Cookie，请确认操作");
    }
  } else {
    // 如果URL或方法不匹配，不执行任何操作
  }
  // 对于重写脚本，使用空对象结束
  $done({});
}

/**
 * 执行每日签到的函数 (由定时任务触发)
 */
async function daySign() {
  const storedCookie = $prefs.valueForKey(cookieKey);

  if (!storedCookie) {
    console.log(`[${scriptName}] 脚本中止，未找到存储的Cookie`);
    $notify(scriptName, "❌ 任务执行失败", "请先按说明手动签到一次以获取Cookie");
    return;
  }

  const request = {
    url: signinUrl,
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 unicom{version:iphone_c@11.0602}",
      "Referer": "https://img.client.10010.com",
      "Origin": "https://img.client.10010.com",
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json, text/plain, */*",
      "Cookie": storedCookie,
    },
    body: {}
  };

  // 使用$task.fetch发送异步请求
  try {
    const response = await $task.fetch(request);
    const body = JSON.parse(response.body);

    if (body.code === '0000') {
      const reward = body.data?.redSignMessage || "未知奖励";
      console.log(`[${scriptName}] 签到成功: ${reward}`);
      $notify(scriptName, "✅ 签到成功", `抽奖奖励：${reward}`);
    } else {
      console.log(`[${scriptName}] 签到提醒: ${body.desc}`);
      // 对于“已签到”等情况，也发送通知
      $notify(scriptName, "ℹ️ 签到提醒", body.desc || "未知响应");
    }
  } catch (error) {
    console.log(`[${scriptName}] 签到失败: ${error}`);
    $notify(scriptName, "❌ 签到异常", "请求失败或服务器响应格式错误");
  }
}
