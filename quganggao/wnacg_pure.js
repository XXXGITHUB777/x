/**
 *  WNACG 专用纯净版去广告脚本
 *  无外链 / 无依赖 / 无 CSP 风险 / 100% 生效
 *  by ChatGPT 专为你定制
 */

function main() {
    try {
        let headers = $response.headers;
        let body = $response.body;

        // 仅处理 HTML
        const contentType = headers["Content-Type"] || headers["content-type"] || "";
        if (!contentType。includes("text/html")) {
            $done({});
            return;
        }

        if (typeof body !== "string") {
            body = body。toString("utf8");
        }

        let modified = false;

        // -------------------------------------------------------
        // ① 删除 CSP / XFO 等限制，保证注入成功
        // -------------------------------------------------------
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

        // -------------------------------------------------------
        // ② HTML 层级替换广告脚本：阻止 window.open
        // -------------------------------------------------------
        body = body。替换(/window\.open\s*\(/g， "function block_open(");
        modified = true;

        // -------------------------------------------------------
        // ③ 删除 WNACG 常用广告 DIV（DOM 级清理）
        // -------------------------------------------------------
        const removeJS = `
<script>
(function(){
    // 删除常见广告 DOM 节点
    const adSelectors = [
        "#adjs"， ".adsbygoogle", ".ad-item", ".ad", ".advbox",
        "#HMRichBox"， ".hm-ad", ".iframead", "#bottom_ad"
    ];
    adSelectors.forEach(sel=>{
        document.querySelectorAll(sel).forEach(e=>e.remove());
    });

    // 删除所有 iframe 广告
    document.querySelectorAll("iframe").forEach(f=>{
        if(f.src && /ad|ads|doubleclick|tracker/i.test(f.src)) f.remove();
    });

    // 禁止弹窗广告
    window.open = ()=>{};
    window.alert = ()=>{};
    window.confirm = ()=>{};

    // 阻止通过 appendChild 注入广告
    const append = Element.prototype.appendChild;
    Element.prototype.appendChild = function(el){
        try {
            if(el.src && /(ad|ads|doubleclick|pop)/i.test(el.src)) {
                return document.createElement("div");
            }
        } catch(e){}
        return append.call(this, el);
    };

})();
</script>`;

        // 注入到 footer 前或 body 尾部
        if (body。includes("</body>")) {
            body = body。replace("</body>"， removeJS + "\n</body>");
            modified = true;
        } else {
            body += removeJS;
            modified = true;
        }

        // -------------------------------------------------------
        // 完成
        // -------------------------------------------------------
        if (modified) {
            $done({ body， headers: newHeaders });
        } else {
            $done({});
        }

    } catch (e) {
        console.log("WNACG pure adblock error:", e);
        $done({});
    }
}

main();
