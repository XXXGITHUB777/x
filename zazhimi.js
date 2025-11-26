/**
 * BuyiTunes.js


const productidmap = {
    "com.zazhimi.zazhimiPro": {
        "isPro": true,
        "expiration": "2099-12-31T23:59:59Z",
        "purchaseDate": "2020-01-01T00:00:00Z"
    }
};

let body = $response.body;
let url = $request.url;

if (url.includes("buy.itunes.apple.com/verifyReceipt")) {
    try {
        let obj = JSON.parse(body);
        if (obj && obj.receipt && obj.receipt.in_app) {
            // 遍历商品，匹配 productidmap
            for (let i in obj.receipt.in_app) {
                let item = obj.receipt.in_app[i];
                if (productidmap[item.product_id]) {
                    item.expires_date = productidmap[item.product_id].expiration;
                    item.purchase_date = productidmap[item.product_id].purchaseDate;
                    item.cancellation_date = null;
                }
            }
            body = JSON.stringify(obj);
        }
    } catch (e) {
        console.log("BuyiTunes.js 错误:", e);
    }
}

$done({ body });
