/**

 *
 * ==========================================================
 */

var headers = $request.headers;
var cookie = headers['Cookie'] || headers['cookie'] || '';

// 替换已有的 free_play 值，或追加 free_play=0
if (cookie) {
    if (/free_play=\d+/.test(cookie)) {
        cookie = cookie.replace(/free_play=\d+/, 'free_play=0');
    } else {
        cookie += '; free_play=0';
    }
} else {
    cookie = 'free_play=0';
}

headers['Cookie'] = cookie;

$done({ headers: headers });
