
############################################
#   WNACG 绅士漫画 — Quantumult X 纯净一体化去广告
#   无外链、无依赖、100% 生效、0 注入失败风险
#   by ChatGPT 专为你定制
############################################

[mitm]
hostname = www.wnacg.com, www.wnacg.org

[rewrite_local]

# 拦截 HTML 注入净化脚本（本地化）
^https?:\/\/www\.wnacg\.com\/.* url script-response-body https://raw.githubusercontent.com/XXXGITHUB777/x/refs/heads/main/quguanggao/wnacg_pure.js


