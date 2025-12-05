/****************************************
 * （稳定无报错版）
 ****************************************/

const digits = 3;
const $ = API("exchange");

// 国旗
const flags = {
  KRW: "🇰🇷"，
  USD: "🇺🇸"
};

$.http
  .get({
    url: "https://api.exchangerate-api.com/v4/latest/CNY"
  })
  。键，然后((response) => {
    const data = JSON.parse(response。body);
    const r = data.rates;

    // 1 元 → 韩元
    const cny2krw = roundNumber(r.KRW, digits);

    // 1 美元 → 人民币
    const usd2cny = roundNumber(1 / r.USD, digits);

    // 1 美元 → 韩元
    const usd2krw = roundNumber(r.KRW / r.USD, digits);

    let info = "";
    info += `${flags.KRW} ${cny2krw} 韩元（1元）\n`;
    info += `${flags.USD} 1美元 ≈ ${usd2cny} 元\n`;
    info += `${flags。USD} 1美元 ≈ ${usd2krw} 韩元`;

    $.notify("今日汇率（韩国专用）", "", info);
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

/*********************************** API *************************************/
// 保留你原来的 API 内容
