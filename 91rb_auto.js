/**
 * 91rb 自动注册+登录+IP检测 - Quantumult X 重写脚本
 *
 * 工作原理：
 *   1. 拦截视频页面 → 检测是否被限制（limitplayer/no-player）
 *   2. 如果被限制 → 注入提示："请切换QX节点"
 *   3. 如果未限制但需登录 → 自动注册账号+设置cookie
 *   4. 如果可观看 → 不干预
 *
 * 使用方法：
 *   1. 在 QX 中添加此重写
 *   2. 切换 QX 节点
 *   3. 访问 91rb 视频页面
 *   4. 脚本自动检测+注册+登录
 */

const SIGNUP_URL = 'https://www.91rb.net/signup/';

function randStr(len) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var s = '';
    for (var i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

function getUrlParam(url, name) {
    var m = url.match(new RegExp(name + '=([^&]+)'));
    return m ? m[1] : null;
}

const reqUrl = $request.url || '';
const respBody = $response.body || '';

// ====== 拦截视频页面 ======
if (reqUrl.indexOf('/videos/') !== -1 && respBody.indexOf('text/html') === -1) {
    // 检查页面状态
    var hasLimit = respBody.indexOf('limitplayer') !== -1;
    var hasMemberOnly = respBody.indexOf('此视频仅限会员观看') !== -1;
    var hasVideo = respBody.indexOf('<video') !== -1;

    if (hasVideo) {
        // 可观看，不干预
        $done({});
    } else if (hasLimit) {
        // IP被限，注入提示
        var body = respBody.replace('</body>',
            '<div id="qx-tip" style="position:fixed;top:0;left:0;right:0;z-index:999999;' +
            'background:#e74c3c;color:#fff;padding:15px;text-align:center;font-size:16px;' +
            'font-family:sans-serif;font-weight:bold;">' +
            '🔴 当前IP已被限制（今日额度用完）<br>' +
            '<span style="font-size:13px;font-weight:normal;">请切换QX节点后刷新页面</span>' +
            '</div></body>');
        $done({ body: body });
    } else if (hasMemberOnly) {
        // 需要登录，自动注册
        var username = 'rb' + randStr(8);
        var password = 'Pass' + randStr(6) + '!';

        // 注入自动注册脚本
        var injectReg = '<script>' +
            '(function(){' +
            'var u="' + username + '",p="' + password + '";' +
            'var x=new XMLHttpRequest();' +
            'x.open("POST","' + SIGNUP_URL + '",true);' +
            'x.setRequestHeader("Content-Type","application/x-www-form-urlencoded");' +
            'x.setRequestHeader("X-Requested-With","XMLHttpRequest");' +
            'x.onreadystatechange=function(){' +
            'if(x.readyState===4){' +
            'if(x.status===200){' +
            'var t=document.createElement("div");' +
            't.style.cssText="position:fixed;top:0;left:0;right:0;z-index:999999;background:#27ae60;color:#fff;padding:15px;text-align:center;font-size:14px;font-family:sans-serif;";' +
            't.innerHTML="✅ 自动注册成功！<br>用户名: "+u+"<br>密码: "+p+"<br>请刷新页面";' +
            'document.body.appendChild(t);' +
            'setTimeout(function(){location.reload();},2000);' +
            '}else{' +
            'var t=document.createElement("div");' +
            't.style.cssText="position:fixed;top:0;left:0;right:0;z-index:999999;background:#e74c3c;color:#fff;padding:15px;text-align:center;";' +
            't.textContent="❌ 注册失败，请手动注册";' +
            'document.body.appendChild(t);' +
            '}' +
            '}' +
            '};' +
            'x.send("signup_mode=username&username="+u+"&pass="+p+"&pass2="+p+"&action=signup");' +
            '})();' +
            '</script>';

        var body = respBody.replace('</body>', injectReg + '</body>');
        $done({ body: body });
    } else {
        $done({});
    }
} else {
    $done({});
}
