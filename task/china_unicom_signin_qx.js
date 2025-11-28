[rewrite_local]
# 用于首次获取 Cookie，获取成功后请注释此行
^https:\/\/activity\.10010\.com\/sixPalaceGridTurntableLottery\/signin\/daySign url script-request-header https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/task/china_unicom_signin_qx.js
[task_local]
5 9 * * * https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/task/china_unicom_signin_qx.js, tag=中国联通-自动签到, enabled=true

/*
 * @name: 中国联通签到（QX集成优化版）
 * @author: ChatGPT
 * @version: 2.0
 * @mitm: activity.10010.com
 *
 * 说明:
 * 1. 第一次使用保持 rewrite 规则启用，打开联通 App 手动签到一次
 * 2. 看到成功通知后注释 rewrite 规则
 * 3. 定时任务自动签到即可
 */

const scriptName = "中国联通签到";
const cookieKey = "chinaUnicomCookie_v3"; // 统一 key
const signinUrl = "https://activity.10010.com/sixPalaceGridTurntableLottery/signin/daySign";

const isRequest = typeof $request !== "undefined";

(async () => {
  if (isRequest) {
    captureCookie();
  } else {
    await dailySign();
  }
})();

// 捕获 Cookie（仅 POST 手动签到接口触发）
function captureCookie() {
  if ($request.method === "POST" && $request.url.includes("daySign")) {
    const ck = $request.headers["Cookie"] || $request.headers["cookie"];
    if (ck) {
      $prefs.setValueForKey(ck, cookieKey);
      console.log(`✅ ${scriptName} Cookie获取成功`);
      $notify(scriptName, "✅ Cookie获取成功", "可以注释 rewrite 规则了");
    } else {
      console.log(`❌ ${scriptName} 未找到Cookie`);
      $notify(scriptName, "❌ Cookie获取失败", "请求头中未包含Cookie");
    }
  }
  $done({});
}

// 每日签到函数（定时 task 触发）
async function dailySign() {
  const storedCookie = $prefs.valueForKey(cookieKey);
  if (!storedCookie) {
    console.log(`❌ ${scriptName} 未读取到Cookie`);
    $notify(scriptName, "❌ 任务失败", "请先手动签到一次获取Cookie");
    $done();
    return;
  }

  const req = {
    url: signinUrl,
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 unicom{version:iphone_c@11.0602}",
      "Referer": "https://img.client.10010.com",
      "Origin": "https://img.client.10010.com",
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json, text/plain, */*",
      "Cookie": storedCookie,
    },
    body: "", // QX 里 body 不能用 {}，改为空字符串
  };

  try {
    const res = await $task.fetch(req);
    const body = JSON.parse(res.body || "{}");

    if (body.code === "0000") {
      const reward = body.data?.redSignMessage || "未知奖励";
      console.log(`🎯 ${scriptName} 签到成功: ${reward}`);
      $notify(scriptName, "✅ 签到成功", `抽奖奖励：${reward}`);
    } else {
      console.log(`⚠️ ${scriptName} 返回: ${body.desc}`);
      $notify(scriptName, "⚠️ 签到提醒", body.desc || "状态未知");
    }
  } catch (e) {
    console.log(`💥 ${scriptName} 发生错误: ${e}`);
    $notify(scriptName, "❌ 签到异常", "请求失败或解析报错");
  }

  $done();
}
