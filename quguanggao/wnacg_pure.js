/**
 * WNACG — limbopro 去广告系统单站提取版
 * 完整保留 limbopro 注入链（保持成功率）
 * 仅对 WNACG 生效，纯净专版
 * by ChatGPT
 */

const CSS_URL = "https://limbopro.com/CSS/Adblock4limbo.user.css";
const JS_URL  = "https://limbopro.com/Adguard/Adblock4limbo.user.js";

// 注入点
const TITLE_INJECT = `</title>
<link rel="stylesheet" href="${CSS_URL}" />
<script src="${JS_URL}" async></script>
`;

const BODY_INJECT = `
<link rel="stylesheet" href="${CSS_URL}" />
<script src="${JS_URL}" async></script></body>
`;

function main(){
    try {
        const url = $request.url;
        let headers = $response。headers;
        let body = $response.body;

        // -------------------------
        // 只处理 WNACG
        // -------------------------
        if(!/wnacg\.com|wnacg\.org/i.test(url)){
            $done({});
            return;
        }

        // HTML 才处理
        const ct = headers["Content-Type"] || headers["content-type"] || "";
        if(!ct.includes("text/html")){
            $done({});
            return;
        }

        if(typeof body !== "string"){
            body = body.toString("utf8");
        }

        let modified = false;

        // --------------------------------
        // 1) 源码级屏蔽 window.open
        // --------------------------------
        body = body.replace(/window\.open\s*\(/g, 'function block_open(');
        modified = true;

        // --------------------------------
        // 2) limbopro 的 title/body 注入链
        // --------------------------------
        if (/<\/title>/i.test(body)) {
            body = body.replace(/<\/title>/i, TITLE_INJECT);
        } else if (/<\/body>/i.test(body)) {
            body = body.replace(/<\/body>/i, BODY_INJECT);
        } else {
            // 保底注入
            body += BODY_INJECT;
        }
        modified = true;

        // --------------------------------
        // 3) 删除 CSP/XFO
        // --------------------------------
        const newHeaders = { ...headers };
        delete newHeaders["Content-Security-Policy"];
        delete newHeaders["content-security-policy"];
        delete newHeaders["X-Frame-Options"];
        delete newHeaders["x-frame-options"];
        delete newHeaders["Referrer-Policy"];
        delete newHeaders["referrer-policy"];

        newHeaders["Cross-Origin-Embedder-Policy"] = "unsafe-none";
        newHeaders["Cross-Origin-Opener-Policy"] = "unsafe-none";
        newHeaders["Cross-Origin-Resource-Policy"] = "cross-origin";

        // --------------------------------
        // 返回
        // --------------------------------
        if(modified){
            $done({
                headers: newHeaders,
                body
            });
        } else {
            $done({});
        }

    } catch(e){
        console.log("WNACG limbopro extract error:", e);
        $done({});
    }
}

main();
