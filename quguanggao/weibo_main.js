

// 【物理静默】屏蔽日志，杜绝发热
const console = { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };

// 【暴力配置】默认全部开启，不给回旋余地
const config = {
    removeHomeVip: true,
    removeGood: true,        // 杀好物种草
    removeRelate: true,      // 杀相关推荐
    removeFollow: true,      // 杀关注博主
    removeLive: true,        // 杀直播
    removeNext: true,        // 杀自动播放
    removeHotTop: true,      // 杀热搜置顶
    enhancement: true        // 强制高清图 (City Boy 视觉)
}

const url = $request.url;
const body = $response.body;

if (!body || body.indexOf('{') === -1) $done({});

const data = JSON.parse(body);
const route = getRoute(url);

if (route) {
    route(data);
}

$done({ body: JSON.stringify(data) });

// 极速路由分发
function getRoute(url) {
    if (url.includes('profile/me')) return cleanProfile; // 个人中心
    if (url.includes('statuses/extend')) return cleanStatus; // 微博详情
    if (url.includes('comments/')) return cleanComments; // 评论区
    if (url.includes('search/finder')) return cleanFinder; // 发现页
    if (url.includes('search/container_timeline')) return cleanSearch; // 搜索结果
    if (url.includes('video/community_tab')) return cleanVideo; // 视频页
    if (url.includes('statuses/container_timeline_topic')) return cleanTopic; // 超话
    if (url.includes('statuses/show')) return cleanStatus; 
    // 通用流 (首页、好友、分组、热搜流)
    if (url.includes('statuses/') || url.includes('groups/') || url.includes('cardlist') || url.includes('page')) return cleanFeed;
    return null;
}

// -----------------------------------------------------------
// 核心杀手逻辑
// -----------------------------------------------------------

// 1. 通用信息流清洗 (最强力)
function cleanFeed(data) {
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    if (data.trends) delete data.trends;
    if (data.pageHeader) delete data.pageHeader; // 杀热搜Banner
    
    if (data.statuses) {
        data.statuses = data.statuses.filter(s => !checkAd(s));
        if (config.enhancement) data.statuses.forEach(enhancePic);
    }
    
    if (data.items) data.items = processList(data.items);
    if (data.cards) data.cards = processList(data.cards);
}

// 2. 列表处理 (Items/Cards)
function processList(list) {
    if (!list) return [];
    const newList = [];
    
    for (let item of list) {
        // 核心：基于 card_type 的黑名单 (来自 fmz200 的经验值)
        let ct = item.card_type; 
        if (item.data) ct = item.data.card_type;
        
        // 118:横图广告, 182:热议, 9:通用(需检), 165:图片
        // 只要是推广，card_type 不管是啥都杀
        if (checkAd(item.data || item.mblog || item)) continue;

        // 针对 group (卡片组) 的深度清洗
        if (item.card_group) {
            item.card_group = item.card_group.filter(sub => !checkAd(sub) && sub.card_type !== 118);
            if (item.card_group.length === 0) continue;
        }

        // 针对 items (Feed流) 的深度清洗
        if (item.items) {
            item.items = processList(item.items); // 递归清洗
        }

        // 针对 "group" 类型 (可能感兴趣的人/超话/好友)
        if (item.category === 'group') {
            // 只要不是正常的 feed 列表，统统当做干扰项删掉
            // 这里的逻辑比 fmz200 更激进：我不判断是不是好友，只要是 group 且带有推荐性质，直接杀
            const trend = item.trend_name || "";
            if (trend.includes('recommend') || trend.includes('ad')) continue;
            // 杀掉 "空降", "新鲜事"
            if (item.header?.title?.content?.match(/空降|新鲜事/)) continue;
        }

        // 数据净化 (去推广字段)
        const d = item.data || item.mblog;
        if (d) {
            if (d.extend_info) delete d.extend_info; // 杀橱窗
            if (d.common_struct) delete d.common_struct; // 杀绿洲/品牌
            if (config.enhancement) enhancePic(d);
        }

        newList.push(item);
    }
    return newList;
}

// 3. 广告判定 (融合了所有已知特征)
function checkAd(data) {
    if (!data) return false;
    
    // 关键字特征
    if (data.mblogtypename === '广告' || data.mblogtypename === '热推') return true;
    if (data.promotion && data.promotion.type === 'ad') return true;
    if (data.content_auth_info && data.content_auth_info.content_auth_title === '广告') return true;
    
    // 结构特征
    if (data.ads_material_info && data.ads_material_info.is_ads) return true;
    if (data.is_ad === 1) return true;
    
    // ID特征 (最准)
    if (data.itemid) {
        if (data.itemid.includes('is_ad_pos')) return true;
        if (data.itemid.includes('ad_video')) return true;
        if (data.itemid.includes('t:51')) return true; // 热搜置顶
        if (data.itemid.includes('tips')) return true; // 提示条
    }
    
    // 推广类型
    if (data.card_type === 118) return true; // 这种全是广告
    
    return false;
}

// 4. 发现页 (极致空)
function cleanFinder(data) {
    // 杀掉头部 Banner
    if (data.header) delete data.header;
    
    if (data.channelInfo && data.channelInfo.channels) {
        // 只保留 "发现" (id 1001)
        data.channelInfo.channels = data.channelInfo.channels.filter(c => c.id === 1001);
        
        // 深入清洗 Payload
        if (data.channelInfo.channels[0] && data.channelInfo.channels[0].payload) {
            let payload = data.channelInfo.channels[0].payload;
            // 杀掉 "大家正在搜"
            if (payload.loadedInfo) delete payload.loadedInfo.searchBarContent;
            // 清洗流
            if (payload.items) payload.items = processList(payload.items);
        }
    }
}

// 5. 评论区 (杀掉所有非评论内容)
function cleanComments(data) {
    if (data.datas) {
        data.datas = data.datas.filter(c => {
            // 只保留 type 1 (普通评论)
            // 杀掉 type 6 (关注按钮), type 15 (提示)
            if (c.type !== 1) return false; 
            if (c.adType && c.adType !== '显示') return false; // 只要有 adType 标记的通常都不是好东西
            return true;
        });
    }
}

// 6. 详情页
function cleanStatus(data) {
    delete data.trend; // 杀相关推荐
    delete data.reward_info; // 杀打赏
    delete data。follow_data; // 杀头部关注
    delete data.page_alerts; // 杀弹窗
    if (data.custom_action_list) {
        // 菜单只留最基础的
        data。custom_action_list = data。custom_action_list。filter(i => 
            ['mblog_menus_delete'， 'mblog_menus_edit'， 'mblog_menus_copy_url'].includes(i.type)
        );
    }
}

// 7. 个人中心
function cleanProfile(data) {
    if (data。items) {
        data。items = data。items。filter(i => i。itemId === 'profileme_mine');
        if (data.items[0] && data.items[0].header) {
            data。items[0]。header.vipView = null; // 杀VIP背景
        }
    }
}

// 8. 超话
function cleanTopic(data) {
    if (data.items) {
        // 杀掉所有 "未关注" 的推荐 Feed
        data.items = data.items.filter(i => {
            if (i.category === 'feed' && i.data?.buttons?.[0]?.type === 'follow') return false;
            return !checkAd(i.data);
        });
    }
}

// 9. 图片高清化
function enhancePic(data) {
    if (data.pic_infos) {
        for (let k in data.pic_infos) {
            if (data.pic_infos[k].original) {
                data.pic_infos[k].bmiddle.url = data.pic_infos[k].original.url.replace(/orj\d+/, 'oslarge');
                data.pic_infos[k].large.url = data.pic_infos[k].original.url.replace(/orj\d+/, 'oslarge');
            }
        }
    }
}

function cleanSearch(data) {
    cleanFeed(data);
    if (data.loadedInfo) delete data.loadedInfo.searchBarContent;
}

function cleanVideo(data) {
    cleanFeed(data);
}
