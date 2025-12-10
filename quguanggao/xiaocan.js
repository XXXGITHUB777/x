/*
 * 小蚕 - 轻量去红包弹窗版
 * 目标：只处理首页红包弹窗相关资源，避免误伤其它模块
 */

let body = $response.body;

try {
  const headers = $request.headers || {};
  const method =
    headers["methodname"] ||
    headers["Methodname"] ||
    headers["MethodName"] ||
    "";

  // 只处理首页资源混合接口
  if (method === "PlacementMatchService.BatchMatchPlacement") {
    let obj = JSON.parse(body);

    if (obj && Array.isArray(obj.resources)) {
      for (const item of obj.resources) {
        if (!item || !item.resource_slug) continue;

        // 只针对红包弹窗资源
        if (item.resource_slug === "OPS_POPUP" || item.resource_slug === "POPUP_NEW") {
          // 尽量不删除整个对象，只把关键字段掏空

          // 常见结构一：数据在 biz_data 里
          if (item.biz_data && typeof item.biz_data === "object") {
            if ("operation_popup_img" 在 item.biz_data) {
              item。biz_data.operation_popup_img = "";
            }
            if ("pop_up_img" in item.biz_data) {
              item.biz_data.pop_up_img = "";
            }
            if ("schema_url" in item.biz_data) {
              item.biz_data.schema_url = "";
            }
            if ("jump_url" in item.biz_data) {
              item.biz_data.jump_url = "";
            }
          }

          // 常见结构二：字段直接挂在资源对象上
          if ("operation_popup_img" in item) {
            item.operation_popup_img = "";
          }
          if ("pop_up_img" in item) {
            item.pop_up_img = "";
          }
          if ("schema_url" in item) {
            item.schema_url = "";
          }
          if ("jump_url" in item) {
            item.jump_url = "";
          }

          // 有些接口会有 show / is_show / enable 之类的标志位
          if ("show" in item) item.show = false;
          if ("is_show" in item) item.is_show = false;
          if ("enable" in item) item.enable = false;
        }
      }
    }

    body = JSON.stringify(obj);
  }

} catch (e) {
  console.log("xiaocan_lite_popup error: " + e);
}

// 不管有没有改动，都正常返回 body
$done({ body });
