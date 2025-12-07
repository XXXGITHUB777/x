/**
 * @name 微博去广告-原版移植静默版 (Fusion)
 * @version 9.0.Final
 * @description 1:1 复刻 fmz200 和 zmqcherish 的去广告逻辑，物理移除所有日志。
 * @source 逻辑源自你提供的 weibo_ads.js 和 weibo_main.js
 */

// =========================================================
// 0. 全局静默 (彻底解决发烫问题)
// =========================================================
const console = { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };

// =========================================================
// 1. 路由与配置
// =========================================================
const mainConfig = {
    removeHomeVip: true,
    removeHomeCreatorTask: true,
    removeRelate: true,
    removeGood: true,
    removeFollow: true,
    removeLiveMedia: true,
    removePinedTrending: true,
    removeInterestTopic: true
};

const url = $request.url;
const body = $response.body;
if (!body || body[0] !== '{') $done({});
const resp_data = JSON.parse(body);

// 极速路由
if (url.includes('/search/finder')) processFinder(resp_data); // fmz200 逻辑
else if (url.includes('/search/container_timeline') || url.includes('/search/container_discover')) processSearch(resp_data); // fmz200 逻辑
else if (url.includes('/2/page?') || url.includes('/2/flowpage?')) processHotSearch(resp_data); // fmz200 逻辑
else if (url.includes('/statuses/container_timeline_topic') || url.includes('/statuses/container_timeline_topicpage')) processTopic(resp_data); // fmz200 逻辑
else if (url.includes('/statuses/extend')) processExtend(resp_data); // fmz200 + zmq 逻辑
else if (url.includes('/comments/')) processComments(resp_data); // fmz200 逻辑
else if (url.includes('/profile/me')) processProfile(resp_data); // zmq 逻辑
else if (url.includes('/statuses/') || url.includes('/groups/') || url.includes('/cardlist')) processMainFeed(resp_data); // zmq + fmz200 逻辑
else if (url.includes('/video/')) processVideo(resp_data);

$done({ body: JSON.stringify(resp_data) });


// =========================================================
// 2. 核心逻辑区 - 直接移植 weibo_ads.js (fmz200) 
// =========================================================

// 处理发现页 (fmz200 核心逻辑)
function processFinder(data) {
    if (!data.channelInfo || !data.channelInfo.channels) return;
    // 1. 移除多余 Tab
    const keepIds = [1001, 1015, 1016, 1040, 1041, 1043];
    data.channelInfo.channels = data.channelInfo.channels.filter(c => keepIds.includes(c.id));
    
    // 2. 处理 Payload 和 头部 Banner
    if (data.header?.data?.items) removeCommonAds(data.header.data.items);
    
    for (let channel of data.channelInfo.channels) {
        if (channel.payload) {
            // 删除"大家正在搜"
            if (channel.payload.loadedInfo?.searchBarContent) delete channel.payload.loadedInfo.searchBarContent;
            // 递归清理
            if (channel.payload.items) {
                if (channel.payload.items[0]?.items) removeCommonAds(channel.payload.items[0].items);
                removeCommonAds(channel.payload.items);
                removeCategoryFeedAds(channel.payload.items);
            }
        }
    }
}

// 处理搜索/刷新 (fmz200)
function processSearch(data) {
    if (data.loadedInfo?.searchBarContent) delete data.loadedInfo.searchBarContent;
    if (data.items) {
        if (data.items[0]?.items) removeCommonAds(data.items[0].items);
        removeCommonAds(data.items);
        removeCategoryFeedAds(data.items);
    }
    if (data.header?.data?.items) removeCommonAds(data.header.data.items);
}

// 处理热搜 (fmz200)
function processHotSearch(data) {
    if (data.cards && data.cards[0]?.card_group) {
        data.cards[0].card_group = data.cards[0].card_group.filter(g => !g.promotion);
    }
    if (data.items) {
        // flowpage 处理
        if (data.pageHeader) data.pageHeader = {}; // 删掉 Banner
        for (let sub of data.items) {
            if (sub.items) {
                sub.items = sub.items.filter(g => 
                    g.data?.promotion == null && 
                    !g.data?.itemid?.includes("c_type:51") && 
                    !g.data?.itemid?.includes("region_data")
                );
            }
        }
    }
}

// 通用去广告函数 (源自 weibo_ads.js)
function removeCommonAds(items) {
    if (!items) return;
    const keepTypes = [17, 235, 101]; // 保留热搜、热门微博
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        if (item.type === "vertical") { item = {}; continue; } // 移除内嵌模块
        
        const cType = item.data?.card_type;
        // 白名单检查
        if (cType && !keepTypes.includes(cType)) {
            items.splice(i, 1);
            continue;
        }
        
        // 深度清理 17(热搜) 和 235
        if (cType === 17 && item.data.group) removeHotSearchAds(item.data.group);
        if (cType === 235 && item.data.channel_list?.[0]?.group) removeHotSearchAds(item.data.channel_list[0].group);
        
        deleteCommonParams(item);
    }
}

function removeHotSearchAds(groups) {
    if (!groups) return;
    for (let i = groups.length - 1; i >= 0; i--) {
        const g = groups[i];
        if (g.itemid?.includes("is_ad_pos") || g.itemid?.includes("cate_type:tongcheng") || g.promotion) {
            groups.splice(i, 1);
        }
    }
}

function removeCategoryFeedAds(items) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].category === "feed" && items[i].data?.mblogtypename === "广告") {
            items.splice(i, 1);
        }
    }
}

function deleteCommonParams(item) {
    if (item.data?.extend_info) {
        delete item.data.extend_info.shopwindow_cards;
        delete item.data.extend_info.ad_semantic_brand;
    }
    if (item.data) {
        delete item.data.common_struct;
        delete item.data.semantic_brand_params;
    }
}

// 处理超话 (fmz200)
function processTopic(data) {
    if (data.items) {
        data.items = data.items.filter(item => {
            if (item.data?.mblogtypename === "广告") return false;
            // 杀掉未关注的 feed
            if (item.category === "feed" && item.data?.buttons?.[0]?.type === 'follow') return false;
            // 杀掉 card 类型 (保留 feed)
            if (item.category === "card") return false; 
            return true;
        });
    }
}

// 处理评论 (fmz200)
function processComments(data) {
    if (data.datas) {
        data.datas = data.datas.filter(item => item.adType !== "广告" && item.adType !== "推荐" && item.adType !== "相关内容");
    }
    if (data.items) {
        // detail_comment
        data.items = data.items.filter(item => item.type !== "trend" && !item.commentAdType);
    }
}

// =========================================================
// 3. 核心逻辑区 - 直接移植 weibo_main.js (zmqcherish) 
// =========================================================

// 主页流处理 (zmqcherish 逻辑，对 UI 兼容更好)
function processMainFeed(data) {
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    if (data.trends) delete data.trends;
    
    if (data.items) {
        data.items = data.items.filter(item => {
            if (item.category === 'group') {
                // 杀掉感兴趣
                if(['super_topic_recommend_card', 'recommend_video_card'].includes(item.trend_name)) return false;
            }
            return !isAd(item.data);
        });
    }
    
    if (data。statuses) {
        data。statuses = data。statuses。filter(s => !isAd(s));
    }
    
    // 复用 removeCommonAds 处理 items 里的 card
    if (data。items) removeCommonAds(data。items);
}

// 个人中心 (zmqcherish)
function processProfile(data) {
    if (!data.items) return;
    data。items = data。items。filter(item => {
        if (item。itemId === 'profileme_mine') {
            if (item.header) item.header.vipView = null;
            return true;
        }
        if (['100505_-_top8'， '100505_-_newusertask'， '100505_-_vipkaitong'， '100505_-_adphoto']。includes(item。itemId)) return false;
        return true;
    });
}

// 详情页扩展 (fmz200 + zmq 混合)
function processExtend(data) {
    if (data。trend) delete data.trend; // 杀相关推荐
    delete data.reward_info;
    delete data.follow_data;
    delete data.page_alerts;
    delete data.head_cards;
    delete data.top_cards;
    if (data.custom_action_list) {
         data.custom_action_list = data.custom_action_list.filter(i => 
            ['mblog_menus_delete', 'mblog_menus_edit', 'mblog_menus_copy_url'].includes(i.type)
        );
    }
}

function processVideo(data) {
    if (data.data) data.data = {}; // 杀直播
    if (data.statuses) data.statuses = []; // 杀下一条
}

// 通用广告判定 (提取自所有脚本)
function isAd(data) {
    if (!data) return false;
    if (data.mblogtypename?.includes('广告') || data.mblogtypename?.includes('热推')) return true;
    if (data.promotion?.type === 'ad') return true;
    if (data.content_auth_info?.content_auth_title?.includes("广告")) return true;
    if (data.ads_material_info?.is_ads) return true;
    if (data.is_ad === 1) return true;
    return false;
}
