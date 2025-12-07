/**
 * @author @fmz200 & @zmqcherish
 * @function 微博去广告 - v1.5 轻量修正版
 * @date 2025-12-07
 * @desc 回归v1的极简架构，修复信息流广告漏网之鱼，移除eval，极致省电
 */

const $ = new Env("微博去广告Lite");

const mainConfig = {
    isDebug: false,                // 保持关闭，省电核心
    removeHomeVip: true,
    removeHomeCreatorTask: true,
    removeRelate: true,
    removeGood: true,
    removeFollow: true,
    modifyMenus: true,
    removeRelateItem: true,
    removeRecommendItem: true,
    removeRewardItem: true,
    removeLiveMedia: true,
    removeNextVideo: true,         // 关闭自动播放，省流省电
    removePinedTrending: true,
    removeInterestFriendInTopic: true, 
    removeInterestTopic: true,
    removeUnfollowTopic: true,
    removeInterestUser: true,
    removeLvZhou: true,
    removeSearchWindow: true,
    profileSkin1: null,
    profileSkin2: null
}

// 路由映射：放弃eval，使用更安全的直接函数调用
const urlHandlers = {
    '/profile/me': removeHome,
    '/statuses/extend': itemExtendHandler,
    '/video/remind_info': removeVideoRemind,
    '/checkin/show': removeCheckin,
    '/live/media_homelist': removeMediaHomelist,
    '/comments/build_comments': removeComments,
    '/container/get_item': containerHandler,
    '/profile/container_timeline': userHandler,
    '/video/tiny_stream_video_list': nextVideoHandler,
    '/2/statuses/video_mixtimeline': nextVideoHandler,
    '/search/finder': removeSearchMain,
    '/search/container_timeline': removeSearch,
    '/search/container_discover': removeSearch,
    '/2/messageflow': removeMsgAd,
    '/statuses/container_timeline_topic': topicHandler,
    '/statuses/container_timeline': removeFeed,      // 首页推荐流
    '/statuses/container_timeline_unread': removeFeed,
    '/statuses/container_timeline_hot': removeFeed,
    '/statuses/repost_timeline': removeRepost,
    '/cardlist': removeCards,
    'video/community_tab': removeCards,
    '/searchall': removeCards,
    'statuses/friends/timeline': removeFeed,         // 首页关注流
    'statuses/unread_friends_timeline': removeFeed,
    'statuses/unread_hot_timeline': removeFeed,
    'groups/timeline': removeFeed,
    'statuses/home_timeline': removeFeed
};

let url = $request.url;
let body = $response.body;

if (!body || body.indexOf('{') === -1) {
    $.done({});
} else {
    try {
        let handler = null;
        // 简单的路由匹配
        for (let key in urlHandlers) {
            if (url.indexOf(key) > -1) {
                handler = urlHandlers[key];
                break;
            }
        }
        
        if (handler) {
            let data = JSON.parse(body);
            handler(data); // 直接调用函数，比eval快且安全
            $.done({body: JSON.stringify(data)});
        } else {
            $.done({});
        }
    } catch (e) {
        // 出错直接放行，保证APP不崩溃
        $.done({});
    }
}

// 统一的广告判定逻辑 (合并了Cherish和fmz200的规则)
function isAd(data) {
    if (!data) return false;
    // 关键字判定
    if (data.mblogtypename === '广告' || data.mblogtypename === '热推') return true;
    if (data.content_auth_info?.content_auth_title === '广告') return true;
    if (data.promotion?.type === 'ad') return true;
    if (data.is_ad === 1 || data.ad_state === 1) return true;
    if (data.ads_material_info?.is_ads) return true;
    // 隐蔽广告ID判定
    if (data.itemid && (data.itemid.includes("is_ad_pos") || data.itemid.includes("cate_type:tongcheng"))) return true;
    return false;
}

// 统一的清理逻辑：无论是 statuses 还是 items，都走这个清洗流程
function cleanItem(item) {
    if (!item) return null;
    
    // 1. 如果是广告，直接返回null
    let data = item.data || item; // 兼容不同结构
    if (isAd(data)) return null;

    // 2. 如果是正常的微博，清理内部的推广小卡片
    if (data.extend_info) {
        delete data.extend_info.shopwindow_cards; // 移除橱窗（顽固广告）
        delete data.extend_info.ad_semantic_brand;
    }
    if (data.common_struct) {
        // 移除绿洲
        if (mainConfig.removeLvZhou) {
            data.common_struct = data.common_struct.filter(i => i.name !== '绿洲');
        }
        if (data.common_struct.length === 0) delete data.common_struct;
    }
    
    // 3. 高清图保留 (用户原脚本逻辑)
    if (data.pic_infos) {
        for (let key in data.pic_infos) {
            let picture = data.pic_infos[key];
            if (picture?.original?.url) {
                let high_url = picture.original.url.replace("orh1080", "oslarge");
                picture.largest = { url: high_url };
                picture.thumbnail = { url: high_url };
                picture.large = { url: high_url };
                picture.bmiddle = { url: high_url };
            }
        }
    }
    
    return item;
}

// 核心：处理所有类型的信息流 (Feed)
function removeFeed(data) {
    // 移除顶层广告对象
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    
    // 处理 statuses 数组 (关注流常见)
    if (data.statuses && data.statuses.length > 0) {
        let newStatuses = [];
        for (let s of data.statuses) {
            let clean = cleanItem(s);
            if (clean) newStatuses.push(clean);
        }
        data.statuses = newStatuses;
    }
    
    // 处理 items 数组 (推荐流常见)
    if (data.items && data.items.length > 0) {
        let newItems = [];
        for (let item of data.items) {
            // 过滤推荐超话等干扰项
            if (item.category === 'group' || (item.data && item.data.card_type === 19)) {
                 // 保留部分有用group，过滤垃圾
                 if (checkJunkTopic(item)) continue;
            }
            // 过滤广告
            let clean = cleanItem(item);
            if (clean) newItems.push(clean);
        }
        data.items = newItems;
    }
}

function checkJunkTopic(item) {
    if (item.category !== 'group') return false;
    try {
        // 过滤：超话推荐卡片、视频推荐卡片
        if(['super_topic_recommend_card', 'recommend_video_card'].indexOf(item.trend_name) > -1) return true;
    } catch (e) {}
    return false;
}

// ---------------- 以下为辅助模块，保持极简 ----------------

function removeRepost(data) {
    if (data.reposts) data.reposts = data.reposts.filter(item => !isAd(item));
    return data;
}

function topicHandler(data) {
    if (!data.items) return;
    // 仅保留 19(分类) 和 179(关注超话)
    data.items = data.items.filter(c => {
        if (isAd(c.data)) return false;
        let ct = c.data?.card_type;
        if (ct === 19 || ct === 179) return true;
        if (c.category === 'feed') return true; // 保留正常Feed
        return false;
    });
}

function removeSearchMain(data) {
    let channels = data.channelInfo?.channels;
    if (channels) channels.forEach(c => { if(c.payload) removeSearch(c.payload); });
}

function removeSearch(data) {
    if (!data.items) return;
    data.items = data.items.filter(item => {
        if (item.category === 'feed') return !isAd(item.data);
        if (item.category === 'card' && mainConfig.removeSearchWindow && 
           (item.data?.itemid === 'finder_window' || item.data?.itemid === 'more_frame')) return false;
        return true;
    });
}

function removeCards(data) {
    if (!data.cards) return;
    data.cards = data.cards.filter(card => {
        // 移除Banner (card_group为空但有itemid的情况)
        if (card.itemid && card.itemid.indexOf('banner') > -1) return false;
        // 移除卡片广告
        if ([9, 165].indexOf(card.card_type) > -1 && isAd(card.mblog)) return false;
        
        // 处理内部group
        if (card.card_group) {
            card.card_group = card.card_group.filter(g => g.card_type !== 118 && !g.promotion && !isAd(g));
            if (card.card_group.length === 0) return false;
        }
        return true;
    });
}

function removeHome(data) {
    if (!data.items) return;
    data.items = data.items.filter(item => {
        let id = item.itemId;
        if (id === 'profileme_mine') {
            if (mainConfig.removeHomeVip && item.header) item.header.vipView = null;
            return true;
        }
        if (['100505_-_top8', 'mine_attent_title', '100505_-_meattent_pic', '100505_-_newusertask', 
             '100505_-_vipkaitong', '100505_-_hongbao2022', '100505_-_adphoto'].includes(id)) return false;
        if (id.match(/100505_-_meattent_-_\d+/)) return false;
        return true;
    });
}

function removeCheckin(data) { data.show = 0; }
function removeMediaHomelist(data) { if (mainConfig.removeLiveMedia) data.data = {}; }
function removeComments(data) {
    let del = ['广告'];
    if (mainConfig。removeRelateItem) del.push('相关内容'， '相关评论');
    if (mainConfig。removeRecommendItem) del.push('推荐'， '热推');
    if (data。datas) data.datas = data.datas。filter(i => !del.includes(i。adType) && !isAd(i.data) && i。输入 !== 6 && i。输入 !== 15);
}
function containerHandler(data) {
    if (mainConfig。removeInterestFriendInTopic && data。card_type_name === '超话里的好友') data.card_group = [];
    if (mainConfig。removeInterestTopic && data。itemid && (data。itemid。includes('infeed_may_interest_in') || data.itemid.includes('infeed_friends_recommend'))) data.card_group = [];
}
function userHandler(data) {
    removeFeed(data);
    if (mainConfig。removeInterestUser && data。items) {
        data。items = data。items。filter(i => !(i.category === 'group' && i.items && i。items[0]?.data?.desc === '可能感兴趣的人'));
    }
}
function nextVideoHandler(data) { if (mainConfig.removeNextVideo) { data.statuses = []; data.tab_list = []; } }
function removeVideoRemind(data) { data.bubble_dismiss_time = 0; data.exist_remind = false; data.image_dismiss_time = 0; data.image = ''; }
function removeMsgAd(data) { if (data.messages) data.messages = data.messages.filter(m => !m.msg_card?.ad_tag); }
function itemExtendHandler(data) {
    if (mainConfig.removeRelate && data.trend?.titles?.title === '相关推荐') delete data.trend;
    if (mainConfig。removeGood && data。trend?.titles?.title === '博主好物种草') delete data。trend;
    if (mainConfig。removeFollow) data。follow_data = null;
    if (mainConfig.removeRewardItem) data.reward_info = null;
    if (data.page_alerts) data.page_alerts = null;
    if (data.trend?.extra_struct?.extBtnInfo?.btn_picurl?.includes('timeline_icon_ad_delete')) delete data.trend;
    if (mainConfig.modifyMenus && data.custom_action_list) {
        let newActions = [];
        for (const item of data.custom_action_list) {
            let add = itemMenusConfig[item.type];
            if (add === undefined) newActions.push(item);
            else if (item.type === 'mblog_menus_copy_url') newActions.unshift(item);
            else if (add) newActions.push(item);
        }
        data.custom_action_list = newActions;
    }
}

function Env(t) {
    this.done = (t) => $done(t);
}
