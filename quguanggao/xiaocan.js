/**
 * 小蚕霸王餐 - 深度净化脚本
 * 覆盖：开屏、首页Banner、金刚区广告、运营弹窗、红包诱导
 */

var body = $response.body;
var url = $request.url;
// 获取 methodname，兼容不同大小写情况
var method = $request.headers["methodname"] || $request.headers["Methodname"] || "";

if (body) {
    try {
        var obj = JSON.parse(body);

        // [场景1] 核心混合接口 (BatchMatchPlacement)
        // 这是一个“大杂烩”接口，既有广告，也有首页 Tab 名字。
        // 如果直接 reject，APP 首页会变成空白。
        if (method === "PlacementMatchService.BatchMatchPlacement") {
            if (obj.resources && obj.resources.length > 0) {
                const keepSlugs = [
                    "HOME_TAB_NAMES",       // 必须保留：首页顶部 Tab
                    "SAFETY_GUARANTEE",     // 必须保留：底部保障文案
                    "FANLIQUAN_DESCRIPTION" // 必须保留：返利券说明
                ];
                // 过滤掉不在白名单里的所有模块 (BANNER, OPS_POPUP, XC_JG 等)
                obj.resources = obj.resources.filter(item => keepSlugs.includes(item.resource_slug));
            }
        }

        // [场景2] 纯广告列表 (GetBannerList)
        // 你原来的规则是 reject，这里改写为空数据更安全，防止客户端报错重试
        if (method === "SilkwormService.GetBannerList") {
            obj = {}; // 直接返回空对象
        }

        // [场景3] 各种弹窗 (新人、VIP、订单奖励)
        // 统统把 show 字段改为 false
        if (method.includes("Popup") || method.includes("IsNewUser")) {
            if (obj.activity) obj.activity.show = false;
            if (obj.data) obj.data = null;
            obj.show = false;
        }

        // [场景4] 红包诱导 Banner
        if (method === "NewUserMobileService.GetFullRewardBanner") {
            obj.status = { "code": 0 };
            obj.users = null;
        }

        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        // 如果解析失败，直接返回原数据，避免 crash
        console.log("小蚕净化脚本错误: " + e);
        $done({});
    }
} else {
    $done({});
}
