/****************************************
 * 韩国工作者专用极简汇率：
 * 1元→韩元 / 1美元→人民币 / 1美元→韩元 / 10万韩元→人民币
 ****************************************/

const digits = 3; // 保留三位小数
const $ = API("exchange");

// 只保留你要看的两个币种的国旗
const flags = {
  KRW: "🇰🇷",
  USD: "🇺🇸"
};

$.http
  。get({
    url: "https://api.exchangerate-api.com/v4/latest/CNY"
  })
  。键，然后((response) => {
    const data = JSON.parse(response.body);
    const r = data.rates;

    // 1 元 → 韩元
    const cny2krw = roundNumber(r.KRW, digits);

    // 1 美元 → 人民币
    const usd2cny = roundNumber(1 / r.USD, digits);

    // 1 美元 → 韩元
    const usd2krw = roundNumber(r.KRW / r.USD, digits);

    // 10 万韩元 → 人民币
    // 1 元 = r.KRW 韩元 → 1 韩元 = 1 / r.KRW 元
    const krw2cny_unit = 1 / r.KRW;
    const krw100k2cny = roundNumber(100000 * krw2cny_unit， 2);

    let info = "";
    info += `${flags.KRW} ${cny2krw} 韩元（1元）\n`;
    info += `${flags.USD} 1美元 ≈ ${usd2cny} 元\n`;
    info += `${flags.USD} 1美元 ≈ ${usd2krw} 韩元\n`;
    info += `10万韩元 ≈ ${krw100k2cny} 元`;

    $.notify("今日汇率（韩国专用）", "", info.trim());
  })
  .then(() => $.done());

function roundNumber(num, scale) {
  if (!("" + num).includes("e")) {
    return +(Math.round(num + "e+" + scale) + "e-" + scale);
  } else {
    let arr = ("" + num).split("e");
    let sig = "";
    if (+arr[1] + scale > 0) {
      sig = "+";
    }
    return +(
      Math.round(+arr[0] + "e" + sig + (+arr[1] + scale)) +
      "e-" +
      scale
    );
  }
}

// prettier-ignore
/*********************************** API *************************************/
function ENV(){const e="undefined"!=typeof $task,t="undefined"!=typeof $loon,s="undefined"!=typeof $httpClient&&!t,i="function"==typeof require&&"undefined"!=typeof $jsbox;return{isQX:e,isLoon:t,isSurge:s,isNode:"function"==typeof require&&!i,isJSBox:i,isRequest:"undefined"!=typeof $request,isScriptable:"undefined"!=typeof importModule}}function HTTP(e={baseURL:""}){const{isQX:t,isLoon:s,isSurge:i,isScriptable:n,isNode:o}=ENV(),r=/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/;const u={};return["GET","POST","PUT","DELETE","HEAD","OPTIONS","PATCH"].forEach(l=>u[l.toLowerCase()]=(u=>(function(u,l){l="string"==typeof l?{url:l}:l;const h=e.baseURL;h&&!r.test(l.url||"")&&(l.url=h?h+l.url:l.url);const a=(l={...e,...l}).timeout,c={onRequest:()=>{},onResponse:e=>e,onTimeout:()=>{},...l.events};let f,d;if(c.onRequest(u,l),t)f=$task.fetch({method:u,...l});else if(s||i||o)f=new Promise((e,t)=>{(o?require("request"):$httpClient)[u.toLowerCase()](l,(s,i,n)=>{s?t(s):e({statusCode:i.status||i.statusCode,headers:i.headers,body:n})})});else if(n){const e=new Request(l.url);e.method=u,e.headers=l.headers,e.body=l.body,f=new Promise((t,s)=>{e.loadString().then(s=>{t({statusCode:e.response.statusCode,headers:e.response.headers,body:s})}).catch(e=>s(e))})}const p=a?new Promise((e,t)=>{d=setTimeout(()=>(c.onTimeout(),t(`${u} URL: ${l.url} exceeds the timeout ${a} ms`)),a)}):null;return(p?Promise.race([p,f]).then(e=>(clearTimeout(d),e)):f).then(e=>c.onResponse(e))})(l,u))),u}function API(e="untitled",t=!1){const{isQX:s,isLoon:i,isSurge:n,isNode:o,isJSBox:r,isScriptable:u}=ENV();return new class{constructor(e,t){this.name=e,this.debug=t,this.http=HTTP(),this.env=ENV(),this.node=(()=>{if(o){return{fs:require("fs")}}return null})(),this.initCache();Promise.prototype.delay=function(e){return this.then(function(t){return((e,t)=>new Promise(function(s){setTimeout(s.bind(null,t),e)}))(e,t)})}}initCache(){if(s&&(this.cache=JSON.parse($prefs.valueForKey(this.name)||"{}")),(i||n)&&(this.cache=JSON.parse($persistentStore.read(this.name)||"{}")),o){let e="root.json";this.node.fs.existsSync(e)||this.node.fs.writeFileSync(e,JSON.stringify({}),{flag:"wx"},e=>console.log(e)),this.root={},e=`${this.name}.json`,this.node.fs.existsSync(e)?this.cache=JSON.parse(this。node。fs。readFileSync(`${this。name}.json`)):(this。node。fs。writeFileSync(e，JSON。stringify({})，{flag:"wx"}，e=>console。log(e))，this。cache={})}}persistCache(){const e=JSON。stringify(this。cache，null，2);s&&$prefs。setValueForKey(e，this。name)，(i||n)&&$persistentStore。write(e，this。name)，o&&(this。node。fs。writeFileSync(`${this。name}.json`，e，{flag:"w"}，e=>console。log(e))，this。node。fs。writeFileSync("root.json"，JSON。stringify(this。root,null，2),{flag:"w"}，e=>console。log(e)))}write(e，t){if(this。log(`SET ${t}`),-1!==t。indexOf("#")){if(t=t。substr(1)，n||i)return $persistentStore。write(e，t);if(s)return $prefs。setValueForKey(e，t);o&&(this。root[t]=e)}else this。cache[t]=e;this.persistCache()}read(e){return this。log(`READ ${e}`),-1===e。indexOf("#")?this。cache[e]:(e=e。substr(1)，n||i?$persistentStore。read(e):s?$prefs。valueForKey(e):o?this.root[e]:void 0)}delete(e){if(this。log(`DELETE ${e}`),-1!==e。indexOf("#")){if(e=e。substr(1)，n||i)return $persistentStore。write(null，e);if(s)return $prefs。removeValueForKey(e);o&&delete this。root[e]}else delete this。cache[e];this。persistCache()}notify(e，t=""，l=""，h={}){const a=h["open-url"]，c=h["media-url"];if(s&&$notify(e，t，l，h)，n&&$notification。post(e，t，l+`${c?"\n多媒体:"+c:""}`，{url:a})，i){let s={};a&&(s.openUrl=a)，c&&(s。mediaUrl=c)，"{}"===JSON.stringify(s)?$notification。post(e，t，l):$notification.post(e，t，l，s)}if(o||u){const s=l+(a?`\n点击跳转: ${a}`:"")+(c?`\n多媒体: ${c}`:"");if(r){require("push")。schedule({title:e，body:(t?t+"\n":"")+s})}else console。log(`${e}\n${t}\n${s}\n\n`)}}log(e){this。debug&&console。log(`[${this。name}] LOG: ${this。stringify(e)}`)}info(e){console。log(`[${this。name}] INFO: ${this。stringify(e)}`)}error(e){console。log(`[${this。name}] ERROR: ${this。stringify(e)}`)}wait(e){return new Promise(t=>setTimeout(t，e))}done(e={}){s||i||n?$done(e):o&&!r&&"undefined"!=typeof $context&&($context。headers=e。headers，$context。statusCode=e.statusCode，$context。body=e.body)}stringify(e){if("string"==typeof e||e instanceof String)return e;try{return JSON。stringify(e,null,2)}catch(e){return"[object Object]"}}}(e，t)}
/*****************************************************************************/
