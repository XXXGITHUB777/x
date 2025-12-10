/*
 * 小蚕：去掉首页「红包弹窗」+ 信息流红包广告
 * 场景：Quantumult X，script-response-body
 * 逻辑：
 *  - 只处理 methodname = PlacementMatchService.BatchMatchPlacement 的响应
 *  - 删除 resource_slug 为 OPS_POPUP / POPUP_NEW / MESSAGE_PLACE 的资源
 */

let body = $response.body;

try {
  const headers = $request.headers || {};
  const methodName =
    headers["methodname"] ||
    headers["Methodname"] ||
    headers["MethodName"] ||
    "";

  // 只处理首页资源匹配接口
  if (methodName === "PlacementMatchService.BatchMatchPlacement") {
    let obj = JSON.parse(body);

    if (obj && Array.isArray(obj.resources)) {
      const blockSlugs = ["OPS_POPUP", "POPUP_NEW", "MESSAGE_PLACE"];

      obj.resources = obj.resources.filter(r => {
        const slug = r && r.resource_slug;
        return !blockSlugs.includes(slug);
      });
    }

    body = JSON.stringify(obj);
  }
} catch (e) {
  console.log("xiaocan_ops_popup error: " + e);
}

// 返回修改后的 body（或者原始 body）
$done({ body });
