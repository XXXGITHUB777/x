/**
 * @author @fmz200 & @zmqcherish
 * @function 微博去广告 - 强力修复版
 * @date 2025-12-07
 * @desc 修复信息流广告漏网之鱼，保留极致省电逻辑（无日志、无皮肤）
 */

const $ = new Env("微博去广告强力版");

const mainConfig = {
    isDebug: false,                // 关闭调试日志，省电
    removeHomeVip: true,           // 移除个人中心VIP栏
    removeHomeCreatorTask: true,   // 移除创作者中心轮播
    removeRelate: true,            // 移除详情页“相关推荐”
    removeGood: true,              // 移除“博主好物种草”
    removeFollow: true,            // 移除“关注博主”按钮
    modifyMenus: true,             // 精简长按菜单
    removeRelateItem: true,        // 移除评论区“相关内容”
    removeRecommendItem: true,     // 移除评论区“推荐内容”
    removeRewardItem: true,        // 移除打赏模块
    removeLiveMedia: true,         // 移除首页顶部直播
    removeNextVideo: true,         // 关闭自动播放下一个视频
    removePinedTrending: true,     // 移除热搜置顶
    removeInterestFriendInTopic: true, 
    removeInterestTopic: true,
    removeUnfollowTopic: true,
    removeInterestUser: true,      // 移除可能感兴趣的人
    removeLvZhou: true,            // 移除绿洲
    removeSearchWindow: true,      // 移除搜索页浮窗
    
    profileSkin1: null,            // 关闭皮肤逻辑
    profileSkin2: null
}

const itemMenusConfig = {
    creator_task: false, mblog_menus_custom: false, mblog_menus_video_later: false,
    mblog_menus_comment_manager: true, mblog_menus_avatar_widget: false, mblog_menus_card_bg: false,
    mblog_menus_long_picture: true, mblog_menus_delete: true, mblog_menus_edit: true,
    mblog_menus_edit_history: true, mblog_menus_edit_video: false, mblog_menus_sticking: true,
    mblog_menus_open_reward: false, mblog_menus_novelty: false, mblog_menus_favorite: true,
    mblog_menus_promote: false, mblog_menus_modify_visible: true, mblog_menus_copy_url: true,
    mblog_menus_follow: true, mblog_menus_video_feedback: false, mblog_menus_shield: true,
    mblog_menus_report: true, mblog_menus_apeal: false, mblog_menus_home: true
}

const modifyCardsUrls = ['/cardlist', 'video/community_tab', '/searchall', '/page'];
const modifyStatusesUrls = ['statuses/friends/timeline', 'statuses/unread_friends_timeline', 'statuses/unread_hot_timeline', 'groups/timeline', 'statuses/home_timeline'];

const otherUrls = {
    '/profile/me': 'removeHome',
    '/statuses/extend': 'itemExtendHandler',
    '/video/remind_info': 'removeVideoRemind',
    '/checkin/show': 'removeCheckin',
    '/live/media_homelist': 'removeMediaHomelist',
    '/comments/build_comments': 'removeComments',
    '/container/get_item': 'containerHandler',
    '/profile/container_timeline': 'userHandler',
    '/video/tiny_stream_video_list': 'nextVideoHandler',
    '/2/statuses/video_mixtimeline': 'nextVideoHandler',
    '/search/finder': 'removeSearchMain',
    '/search/container_timeline': 'removeSearch',
    '/search/container_discover': 'removeSearch',
    '/2/messageflow': 'removeMsgAd',
    '/statuses/container_timeline_topic': 'topicHandler',
    '/statuses/container_timeline': 'removeMain',
    '/statuses/container_timeline_unread': 'removeMain',
    '/statuses/container_timeline_hot': 'removeMain',
    '/statuses/repost_timeline': 'removeRepost'
}

let url = $request.url;
let body = $response.body;

if (!body || body.indexOf('{') === -1) {
    $.done({});
} else {
    try {
        let method = getModifyMethod(url);
        if (method) {
            let data = JSON.parse(body);
            let func = eval(method);
            new func(data);
            $.done({body: JSON.stringify(data)});
        } else {
            $.done({});
        }
    } catch (e) {
        console.log("Weibo Script Error: " + e.message);
        $.done({});
    }
}

function getModifyMethod(url) {
    for (const s of modifyCardsUrls) {
        if (url.indexOf(s) > -1) return 'removeCards';
    }
    for (const s of modifyStatusesUrls) {
        if (url.indexOf(s) > -1) return 'removeTimeLine';
    }
    const path = Object.keys(otherUrls).find(path => url.includes(path));
    if (path) return otherUrls[path];
    return null;
}

// 核心判断逻辑：恢复了完整的广告特征检查
function isAd(data) {
    if (!data) return false;
    
    // 1. 明显的文字标记
    if (data.mblogtypename === '广告' || data.mblogtypename === '热推') return true;
    if (data.content_auth_info?.content_auth_title === '广告') return true;
    
    // 2. 字段标记
    if (data.is_ad === 1) return true;
    if (data.ad_state === 1) return true;
    
    // 3. 推广结构体
    if (data.promotion && data.promotion.type === 'ad') return true;
    if (data.ads_material_info && data.ads_material_info.is_ads) return true;
    
    // 4. 隐蔽的广告ID特征 (来自weibo_ads.js)
    if (data.itemid && (data.itemid.includes("is_ad_pos") || data.itemid.includes("cate_type:tongcheng"))) return true;

    return false;
}

// 深度清理：移除微博正文中的推广卡片（如橱窗、品牌tag）
function cleanStatus(item) {
    if (!item.data) return item;
    // 高清图处理 (保留优化)
    if (item.data.pic_infos) {
        for (let key in item.data.pic_infos) {
            let picture = item.data.pic_infos[key];
            let high_url = picture.original.url.replace("orh1080", "oslarge");
            picture.largest.url = high_url;
            picture.thumbnail.url = high_url;
            picture.large.url = high_url;
            picture.middleplus.url = high_url;
            picture.mw2000.url = high_url;
            picture.bmiddle.url = high_url;
        }
    }
    // 移除推广小卡片
    if (item.data.extend_info) {
         delete item.data.extend_info.shopwindow_cards; // 橱窗
         delete item.data.extend_info.ad_semantic_brand; // 品牌
    }
    if (item.data.semantic_brand_params) delete item.data.semantic_brand_params;
    if (item.data.common_struct) delete item.data.common_struct;
    
    return item;
}

// 处理标准的 status 时间流
function removeTimeLine(data) {
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    if (data.trends) delete data.trends;
    
    if (!data.statuses) return;
    
    let newStatuses = [];
    for (const s of data.statuses) {
        if (!isAd(s)) {
            // 绿洲模块移除
            if (mainConfig.removeLvZhou && s.common_struct) {
                 s.common_struct = s.common_struct.filter(i => i.name !== '绿洲');
            }
            newStatuses.push(cleanStatus({data: s}).data); // 复用cleanStatus逻辑
        }
    }
    data.statuses = newStatuses;
}

// 处理 container 类型的流（推荐、热门等）
function removeMain(data) {
    if (!data.items) return data;
    let newItems = [];
    for (let item of data.items) {
        if (checkJunkTopic(item)) continue; // 移除推荐超话卡片
        
        // 必须检查 item.data 是否为广告
        if (!isAd(item.data)) {
            // 有些广告藏在 category = 'feed' 但 data 中有 promotion
            if (item.category === 'feed' && item.data && item.data.mblogtypename === '广告') continue;
            newItems.push(cleanStatus(item));
        }
    }
    data.items = newItems;
    return data;
}

function checkJunkTopic(item) {
    if (item.category !== 'group') return false;
    try {
        if(['super_topic_recommend_card', 'recommend_video_card'].indexOf(item.trend_name) > -1) return true;
    } catch (error) {}
    return false;
}

function removeRepost(data) {
    if (data.reposts) data.reposts = data.reposts.filter(item => !isAd(item));
    if (data.hot_reposts) data.hot_reposts = data.hot_reposts.filter(item => !isAd(item));
    return data;
}

// 增强的超话处理 (合并了 weibo_ads.js 的逻辑)
function topicHandler(data) {
    const items = data.items;
    if (!items) return data;
    
    // 过滤掉 card_type 19/179 以外的干扰项，或者广告
    const validCardTypes = [19, 179]; 
    let newItems = [];
    let foundFeed = false;

    for (let c of items) {
        if (isAd(c.data)) continue;

        let category = c.category;
        let cardType = c.data?.card_type;

        // 如果配置了移除未关注，且这是个 Feed，且含有关注按钮，则移除
        if (mainConfig.removeUnfollowTopic && category === 'feed' && c.data?.buttons?.[0]?.type === 'follow') continue;

        // 核心清理逻辑
        if (validCardTypes.includes(cardType)) {
             newItems.push(c);
             continue;
        }

        if (foundFeed && category !== 'feed') continue; // Feed流之后的非Feed内容通常是干扰
        if (category === 'feed') foundFeed = true;
        
        // 移除“空降发帖”等干扰group
        if (category === 'group') {
             if (c.header?.title?.content?.includes('空降')) continue;
        }

        newItems.push(c);
    }
    data.items = newItems;
    return data;
}

function removeSearchMain(data) {
    let channels = data.channelInfo?.channels;
    if (!channels) return data;
    for (let channel of channels) {
        if(channel.payload) removeSearch(channel.payload);
    }
    return data;
}

function checkSearchWindow(item) {
    if (!mainConfig.removeSearchWindow) return false;
    if (item.category !== 'card') return false;
    return item.data?.itemid === 'finder_window' || item.data?.itemid === 'more_frame';
}

function removeSearch(data) {
    if (!data.items) return data;
    let newItems = [];
    for (let item of data.items) {
        if (item.category === 'feed') {
            if (!isAd(item.data)) newItems.push(cleanStatus(item));
        } else {
            if (!checkSearchWindow(item)) newItems.push(item);
        }
    }
    data.items = newItems;
    return data;
}

function removeMsgAd(data) {
    if (!data.messages) return;
    data.messages = data.messages.filter(msg => !msg.msg_card?.ad_tag);
    return data;
}

// 增强的热搜处理 (Cards类型)
function removeCards(data) {
    if (!data.cards) return;
    let newCards = [];
    for (const card of data.cards) {
        let cardGroup = card.card_group;
        if (cardGroup && cardGroup.length > 0) {
            // 过滤 card_group 内的广告 (类型 118 或 含有 promotion)
            let newGroup = cardGroup.filter(group => {
                if (group.card_type === 118) return false;
                if (group.promotion || group.itemid?.includes("is_ad_pos")) return false;
                return true;
            });
            card.card_group = newGroup;
            newCards.push(card);
        } else {
            // 过滤卡片本身
            if ([9, 165].indexOf(card.card_type) > -1) {
                if (!isAd(card.mblog)) newCards.push(card);
            } else {
                 // 移除 banner 广告
                if (card.itemid && card.itemid.includes("banner")) continue;
                newCards.push(card);
            }
        }
    }
    data.cards = newCards;
}

function removeHome(data) {
    if (!data.items) return data;
    let newItems = [];
    for (let item of data.items) {
        let itemId = item.itemId;
        if (itemId === 'profileme_mine') {
            if (mainConfig.removeHomeVip && item.header) item.header.vipView = null;
            newItems.push(item);
        } else if (['100505_-_top8', 'mine_attent_title', '100505_-_meattent_pic', '100505_-_newusertask', '100505_-_vipkaitong', '100505_-_hongbao2022', '100505_-_adphoto', '100505_-_hongrenjie2022', '100505_-_weibonight2023'].indexOf(itemId) > -1) {
            continue;
        } else if (itemId === '100505_-_advideo') {
            continue;
        } else if (itemId.match(/100505_-_meattent_-_\d+/)) {
            continue;
        } else {
            newItems.push(item);
        }
    }
    data.items = newItems;
    return data;
}

function removeCheckin(data) { data.show = 0; }
function removeMediaHomelist(data) { if (mainConfig.removeLiveMedia) data.data = {}; }
function removeComments(data) {
    let delType = ['广告'];
    if (mainConfig.removeRelateItem) delType.push('相关内容', '相关评论');
    if (mainConfig.removeRecommendItem) delType.push('推荐', '热推');
    let items = data.datas || [];
    if (items.length === 0) return;
    data.datas = items.filter(item => {
        if (isAd(item.data)) return false;
        if (item.data?.user && ["超话社区", "微博开新年", "微博热搜", "微博视频"].includes(item.data.user.name)) return false;
        if (item.type === 6 || item.type === 15) return false;
        return delType.indexOf(item.adType || '') === -1;
    });
}
function containerHandler(data) {
    if (mainConfig.removeInterestFriendInTopic && data.card_type_name === '超话里的好友') data.card_group = [];
    if (mainConfig。removeInterestTopic && data。itemid) {
        if (data.itemid.indexOf('infeed_may_interest_in') > -1 || data.itemid.indexOf('infeed_friends_recommend') > -1) data.card_group = [];
    }
}
function userHandler(data) {
    data = removeMain(data);
    if (!mainConfig.removeInterestUser || !data.items) return data;
    data。items = data。items。filter(item => {
        if (item。category === 'group') {
             try { if (item.items[0]['data']['desc'] === '可能感兴趣的人') return false; } catch (e) {}
        }
        return true;
    });
    return data;
}
function nextVideoHandler(data) {
    if (mainConfig。removeNextVideo) { data。statuses = []; data。tab_list = []; }
}
function removeVideoRemind(data) {
    data。bubble_dismiss_time = 0; data。exist_remind = false; data。image_dismiss_time = 0;
    data。image = ''; data。tag_image_english = ''; data。tag_image_english_dark = ''; data。tag_image_normal = ''; data。tag_image_normal_dark = '';
}
function itemExtendHandler(data) {
    if ((mainConfig.removeRelate || mainConfig.removeGood) && data.trend?.titles) {
        let title = data.trend.titles.title;
        if ((mainConfig。removeRelate && title === '相关推荐') || (mainConfig.removeGood && title === '博主好物种草')) delete data.trend;
    }
    if (mainConfig.removeFollow) data.follow_data = null;
    if (mainConfig.removeRewardItem) data.reward_info = null;
    if (data.page_alerts) data.page_alerts = null;
    try {
        if (data.trend?.extra_struct?.extBtnInfo?.btn_picurl?.indexOf('timeline_icon_ad_delete') > -1) delete data.trend;
    } catch (e) {}
    if (mainConfig.modifyMenus && data.custom_action_list) {
        let newActions = [];
        for (const item of data.custom_action_list) {
            let add = itemMenusConfig[item.type]
            if (add === undefined) newActions.push(item);
            else if (item.type === 'mblog_menus_copy_url') newActions.unshift(item);
            else if (add) newActions.push(item);
        }
        data.custom_action_list = newActions;
    }
}

function Env(t) {
    this.name = t;
    this.logs = [];
    this.log = (...t) => { if(mainConfig.isDebug) console.log(t.join("\n")); };
    this.done = (t = {}) => { $done(t); };
}
