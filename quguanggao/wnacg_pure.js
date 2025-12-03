/**
 *  WNACG — 终极稳定去广告（纯 HTML 重写，无 JS 注入，无 CSP 限制）
 */

function main(){
    try{
        let headers = $response.headers;
        let body = $response.body;

        // 仅处理 HTML
        const contentType = headers["Content-Type"] || headers["content-type"] || "";
        if (!contentType.includes("text/html")) {
            $done({});
            return;
        }

        // 保证字符串
        if (typeof body !== "string") {
            body = body.toString("utf8");
        }

        // -----------------------------------------------
        // 删除 CSP / XFO 限制（强制允许重写页面）
        // -----------------------------------------------
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

        // -----------------------------------------------
        // ① 直接从源码中删除广告 script/iframe/统计
        // -----------------------------------------------
        body = body
            .replace(/<script[^>]*ad[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<script[^>]*(ads|adjs|advert|pop|doubleclick)[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<iframe[^>]*(ad|ads|doubleclick|pop|tracker)[^>]*>[\s\S]*?<\/iframe>/gi, "")
            .replace(/<img[^>]*(ad|ads|banner)[^>]*>/gi, "")
            .replace(/https?:\/\/[^"' ]*(ad|ads|doubleclick|pop|tracker)[^"' ]*/gi, "");

        // -----------------------------------------------
        // ② 禁止 window.open（源码级替换）
        // -----------------------------------------------
        body = body.replace(/window\.open\s*\(/g, "block_open(");

        // -----------------------------------------------
        // ③ 删除常见广告容器 div
        // -----------------------------------------------
        body = body
            .replace(/<div[^>]*id=["']?(ad|ads|adbox|adjs)[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/<div[^>]*(ad|ads|advert)[^>]*>[\s\S]*?<\/div>/gi, "");

        // -----------------------------------------------
        // 完成
        // -----------------------------------------------
        $done({
            body,
            headers: newHeaders
        });

    } catch(e){
        console.log("WNACG Final Error:", e);
        $done({});
    }
}

main();
