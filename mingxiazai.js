/**
 * Sub-Store rename script (Unified "下载" Renamer)
 * 
 * 特性：
 * 1) ⛔️ 忽略国家/地区，所有节点统一重命名。
 * 2) ⬇️ 统一名称为 "下载" (Download)。
 * 3) 🔢 自动追加序号 (下载 01, 下载 02, ...)。
 * 4) 🧹 默认开启 clear 清理，自动过滤非节点信息。
 */

const inArg = $arguments;

// —— 参数解析 —— //
function boolArg(v, d = false) {
  if (v === undefined || v === null) return d;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return d;
    if (/^(true|1|on|yes)$/i.test(s)) return true;
    if (/^(false|0|off|no)$/i.test(s)) return false;
    return d;
  }
  return !!v;
}

const nx     = boolArg(inArg.nx, false)，     // 过滤高倍率
      blnx   = boolArg(inArg.blnx, false)，   // 仅保留高倍率
      key    = boolArg(inArg.key, false)，    // 关键字过滤
      clear  = boolArg(inArg.clear, true);   // 默认开启清理

// ✅ 统一名称设定
const NAME = "下载"; 

const XHFGF = inArg.sn == undefined ? " " : decodeURI(inArg.sn); // 序号分隔符，默认空格

// 内置信息节点清理正则
const nameclear = /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL)/i;
const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const namenx   = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const keya = /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR||||||/i;

// ==================== 主流程 ====================
function operator(pro) {
  
  // 1. 清理/过滤阶段
  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const keep =
        !(clear && nameclear.test(resname)) &&      // 过滤干扰节点
        !(nx && namenx.test(resname)) &&            // 过滤高倍率
        !(blnx && !nameblnx.test(resname)) &&       // 仅保留高倍率
        !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname)));
      return keep;
    });
  }

  // 2. 暴力重命名阶段
  pro.forEach((e) => {
    // 不区分国家，全部统一
    e.name = NAME; 
  });

  // 3. 自动编号处理
  jxh(pro);
  
  return pro;
}

// ==================== 辅助函数 ====================

// 重名自动编号逻辑
function jxh(e){
  const n=e.reduce((e,n)=>{
    const t=e.find((e)=>e.name===n.name);
    if(t){ 
      t.count++; 
      t.items.push({...n，name:`${n.name}${XHFGF}${t.count.toString().padStart(2,"0")}`});
    } else { 
      e.push({name:n.name,count:1,items:[{...n,name:`${n.name}${XHFGF}01`}],});
    }
    return e;
  },[]);
  
  const t=(typeof Array.prototype.flatMap==='function'?n.flatMap((e)=>e.items):n.reduce((a,e)=>a.concat(e.items),[]));
  e.splice(0,e.length,...t); 
  return e;
}
