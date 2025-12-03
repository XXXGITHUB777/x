############################################
#  WNACG 绅士漫画 去广告（Quantumult X）
#  网络层去广告，不影响页面功能
############################################

[mitm]
hostname = *.wnacg.com, *.wnacg.ru, *.wnacg0*.cc, *.wn0*.ru

[rewrite_local]
########## 广告脚本 ##########
^https?:\/\/.*wnacg.*\/(ads?|adver|advertise|ad\/|adjs|adscript).* url reject

########## 弹窗广告 ##########
^https?:\/\/.*wnacg.*\/(popup|pop|layer|float).* url reject

########## iframe 广告 ##########
^https?:\/\/.*wnacg.*\/iframe\/.* url reject
^https?:\/\/.*wnacg.*\/.*\/iframead.* url reject

########## 图片广告（带 ad 标识） ##########
^https?:\/\/.*wnacg.*\.(gif|png|jpg|jpeg)\?*.*(ad|ads|advert).* url reject-img

########## 第三方统计 ##########
^https?:\/\/.*wnacg.*\/(count|stat|tracker|analytics|log)\/.* url reject

########## 伪装点击/跳转 ##########
^https?:\/\/.*wnacg.*\/(redirect|goto|jump|click).* url reject

########## 广告位 JSON 数据 ##########
^https?:\/\/.*wnacg.*\/api\/ad.* url reject

########## 过滤广告 CSS ##########
^https?:\/\/.*wnacg.*\/css\/(ad|ads|advert).*\.css url reject

########## 过滤广告 JS ##########
^https?:\/\/.*wnacg.*\/js\/(ad|ads|advert).*\.js url reject

########## 第三方广告联盟 ##########
^https?:\/\/.*(doubleclick|googlesyndication|adservice|adsystem)\..* url reject

############################################
#  作者说明：
#  1. 不会影响漫画内容加载
#  2. 可完全屏蔽大部分广告资源
#  3. 如遇特定广告没过滤掉，我可以帮你定制
############################################
