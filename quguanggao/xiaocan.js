/*
 * 小蚕霸王餐 - 防误杀保活版
 * 仅去除：全屏弹窗、新用户弹窗、列表流推广
 * 保留：首页金刚区(业务入口)、顶部Banner(活动入口)
 */

var body = $response.body;
var url = $request.url;
// 兼容各种写法获取 methodname
var method = $request.headers["methodname"] || $request.headers["Methodname"] || $request.headers["MethodName"] || "";

if (body) {
    try {
        var obj = JSON.parse(body);

        // [场景1] 首页布局配置 (BatchMatchPlacement)
        if (method === "PlacementMatchService.BatchMatchPlacement") {
            if (obj.resources && obj.resources.length > 0) {
                // 🚫 仅删除这几个纯广告/干扰模块
                const blockSlugs = [
                    "OPS_POPUP"，      // 首页全屏运营弹窗 (必删)
                    "POPUP_NEW",      // 新人弹窗 (必删)
                    "MESSAGE_PLACE"，  // 信息流中的推广条目 (必删)
                    "AD_FLOAT"        // 悬浮窗广告 (必删)
                ];
                
                // ⚠️ 注意：XC_JG (金刚区) 和 BANNER (轮播图) 不在删除列表中
                // 因为它们包含 "美团红包"、"霸王餐" 等核心入口，删了就"没东西"了。

                obj.resources = obj.resources.filter(item => {
                    return !blockSlugs.includes(item.resource_slug);
                });
            }
        }

        // [场景2] 各种弹窗检测接口 -> 强制返回不显示
        if (method.includes("Popup") || method.includes("IsNewUser")) {
            // 这是一个通用结构处理，防止 App 傻等
            if (obj.activity) {
                obj.activity.show = false;
            }
            if (obj.data) { // 有些接口数据在 data 里
                obj.data = null; 
            }
            obj.show = false; // 最外层开关
        }

        // [场景3] 纯广告 Banner 列表
        // 如果你觉得这里也被杀太狠，可以注释掉下面这段
        if (method === "SilkwormService.GetBannerList") {
            // 返回标准的空列表结构，比 {} 更安全
            obj = { "status": { "code": 0 }, "list": [] }; 
        }

        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        // 如果解析出错，直接返回原始内容，保证 App 不崩
        console.log("小蚕脚本错误: " + e);
        $done({});
    }
} else {
    $done({});
}
