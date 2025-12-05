/****************************************
 * 极简最终版：固定分割线样式 1 （——————————————）
 ****************************************/

const digits = 3;
const $ = API("exchange");

// 固定分割线（你选择的样式 1）
const LINE = "——————————————";

// 国旗（台币使用你指定的红蓝 🇱🇦）
const flags = {
    KRW: "🇰🇷",
    JPY: "🇯🇵",
    TWD: "🇱🇦",
    HKD: "🇭🇰",
    GBP: "🇬🇧",
    USD: "🇺🇸"
};

$。http。get({
    url: "https://api.exchangerate-api.com/v4/latest/CNY"
})
。then((res) => {
    const data = JSON.parse(res.body);
    const r = data.rates;

    let out = "";

    // 上半（人民币兑外币）
    out += `${flags.KRW} ${roundNumber(r.KRW, digits)} 韩元\n`;
    out += `${flags.JPY} ${roundNumber(r.JPY, digits)} 日元\n`;
    out += `${flags.TWD} ${roundNumber(r.TWD, digits)} 台币\n`;
    out += `${flags.HKD} ${roundNumber(r.HKD, digits)} 港币\n`;

    // 分割线
    out += LINE + "\n";

    // 下半（外币兑人民币）
    out += `${flags.GBP} 1英镑 ≈ ${roundNumber(1 / r.GBP, digits)} 元\n`;
    out += `${flags.USD} 1美元 ≈ ${roundNumber(1 / r.USD, digits)} 元\n`;

    $。notify("今日汇率"， ""， out。trim());
})
。then(() => $.done());

// 四舍五入函数
function roundNumber(num, scale) {
    if (!("" + num)。includes("e")) {
        return +(Math.round(num + "e+" + scale) + "e-" + scale);
    } else {
        const arr = ("" + num)。split("e");
        const sig = (+arr[1] + scale > 0) ? "+" : "";
        return +(Math.round(+arr[0] + "e" + sig + (+arr[1] + scale)) + "e-" + scale);
    }
}

/*********************************** API *************************************/
（保持你原脚本的 API）
