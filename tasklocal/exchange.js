/****************************************
 * 韩国工作者专用：人民币→韩元 / 美元→人民币 / 美元→韩元
 * 自动判断：直接从韩元换人民币 VS 先换美元再换人民币
 * 新增：显示 10 万韩元 ≈ ? 元
 ****************************************/

const digits = 3;
const $ = API("exchange");

// 国旗
const flags = {
    KRW: "🇰🇷",
    USD: "🇺🇸",
    CNY: "🇨🇳"
};

$。http。get({
    url: "https://api.exchangerate-api.com/v4/latest/CNY"
})
。键，然后((response) => {
    const data = JSON.parse(response.body);
    const r = data.rates;

    // 1 元 → 韩元
    const cny2krw = roundNumber(r.KRW, digits);

    // 1 美元 → 人民币
    const usd2cny = roundNumber(1 / r。USD， digits);

    // 1 美元 → 韩元
    const usd2krw = roundNumber(r。KRW / r.USD, digits);

    // 10 万韩元换人民币
    // 1 元 = r.KRW 韩元 → 1 韩元 = 1/r.KRW 元
    const krw2cny_unit = 1 / r.KRW;
    const krw100k2cny = roundNumber(100000 * krw2cny_unit, 2);

    // 换汇方式比较
    const A = 1 / r.KRW; // 直接韩元→人民币
    const B = (1 / r.KRW) / (1 / usd2cny); // 通过美元中转

    const diff = roundNumber(Math.abs(A - B) / Math.min(A, B) * 100, 2);

    let suggestion;
    if (A > B) {
        suggestion = `直接从韩元换人民币更划算（+${diff}%）`;
    } else if (B > A) {
        suggestion = `先换成美元再换人民币更划算（+${diff}%）`;
    } else {
        suggestion = "两种方式几乎一样划算";
    }

    // 输出更易读
    let info = "";
    info += `${flags.KRW} 1元 ≈ ${cny2krw} 韩元\n`;
    info += `${flags.USD} 1美元 ≈ ${usd2cny} 元\n`;
    info += `${flags.USD} 1美元 ≈ ${usd2krw} 韩元\n\n`;

    // 🔥 新增：10 万韩元换人民币
    info += `💰 10万韩元 ≈ ${krw100k2cny} 元\n\n`;

    info += `💡 换汇建议：${suggestion}`;

    $.notify("韩国汇款助手", "", info.trim());
})
.then(() => $.done());

function roundNumber(num, scale) {
    if (!("" + num).includes("e")) {
        return +(Math.round(num + "e+" + scale) + "e-" + scale);
    } else {
        let arr = ("" + num).split("e");
        let sig = (+arr[1] + scale > 0) ? "+" : "";
        return +(Math.round(+arr[0] + "e" + sig + (+arr[1] + scale)) + "e-" + scale);
    }
}

/*********************************** API *************************************/
// 保留原脚本底部 API
