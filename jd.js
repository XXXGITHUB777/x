/*
[rewrite_local]
# 1. 京东订单列表
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=orderList url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jd.js

# 2. 京东订单详情
^https?:\/\/api\.m\.jd\.com\/client\.action\?t=\d+&loginType=2&loginWQBiz=golden-trade&appid=m_core&client=iPhone&clientVersion=&build url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/jd.js
[mitm]
hostname = api.m.jd.com
*/

// Quantumult X Script: jd_fix_1552.js
// 🎯 目标：实付 15.52，支付有礼 -1.07，其他全部不动。

// ===================================
// 🔧 数值配置
// ===================================
const TARGET_TOTAL = "15.52";  // 最终实付
const TARGET_GIFT  = "1.07";   // 支付有礼减去的金额 (正数，脚本会自动加负号)

// ===================================
// 🛠️ 脚本逻辑
// ===================================

let obj;
try {
    obj = JSON.parse($response.body);
} catch (e) {
    $done({});
}

const isOrderList = obj && obj.orderList;
const isOrderDetail = obj && obj.body && obj.body.orderCommonVo;

// --- 1. 列表页：只改总价 ---
if (isOrderList) {
    if (obj.orderList && obj.orderList.length > 0) {
        // 修改第一个订单，或者你可以指定 ID
        let targetOrder = obj.orderList[0]; 

        if (targetOrder && targetOrder.orderTotal) {
            targetOrder.orderTotal.currentOrderPrice = TARGET_TOTAL;
            targetOrder.orderTotal.payPrice = TARGET_TOTAL;
            targetOrder.orderTotal.orderActualPrice = TARGET_TOTAL;
            targetOrder.orderTotal.finalPrice = TARGET_TOTAL;
            
            // 同步修改列表预览里的价格
            if (targetOrder.orderWareList && targetOrder.orderWareList.length > 0) {
                targetOrder.orderWareList[0].price = TARGET_TOTAL;
                if (targetOrder.orderWareList[0].priceList) {
                    targetOrder.orderWareList[0].priceList[0].price = TARGET_TOTAL;
                }
                if (targetOrder.totalPrice) {
                    targetOrder.totalPrice.value = TARGET_TOTAL;
                }
            }
        }
    }
}

// --- 2. 详情页：改实付 + 改支付有礼 ---
else if (isOrderDetail) {
    const data = obj.body;

    if (data.orderPriceInfo) {
        // 1. 修改大字的最终实付
        data.orderPriceInfo.factPrice = TARGET_TOTAL;

        // 2. 在价格明细里找到“支付有礼”并修改
        if (data.orderPriceInfo.billsList) {
            let giftFound = false;

            data.orderPriceInfo.billsList.forEach(item => {
                // 匹配关键字：支付有礼、立减、优惠、红包
                // 优先修改“支付有礼”或“立减”
                if (item.title.includes("支付有礼") || item.title.includes("立减") || item.title.includes("促销")) {
                    item.title = "支付有礼"; // 强制统一叫这个名字
                    item.money = `- ¥ ${TARGET_GIFT}`;
                    giftFound = true;
                }
            });

            // 如果没找到现成的“支付有礼”，就手动加一行
            if (!giftFound) {
                data.orderPriceInfo.billsList.push({
                    "title": "支付有礼",
                    "money": `- ¥ ${TARGET_GIFT}`,
                    "operator": "-",
                    "billType": 2
                });
            }
        }
    }
    // 注意：summaryList(时间/单号)、shopList(店名/商品) 这里的代码完全没碰
    // 所以它们会显示服务器返回的真实原始数据。
}

$done({body: JSON.stringify(obj)});
