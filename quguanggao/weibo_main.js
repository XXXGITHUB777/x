/**
 * @author @fmz200 & @zmqcherish
 * @function 微博去广告 - 极致省电魔改版
 * @date 2025-12-07
 */

const $ = new Env("微博去广告省电版");

// 强制覆盖配置，不仅为了去广告，更是为了省资源
const mainConfig = {
    isDebug: false,                // 【关键】关闭调试日志，极大降低I/O发热
    removeHomeVip: true,           // 移除个人中心VIP栏
    removeHomeCreatorTask: true,   // 移除创作者中心轮播
    removeRelate: true,            // 移除详情页“相关推荐”
    removeGood: true,              // 移除“博主好物种草”
    removeFollow: true,            // 移除“关注博主”按钮（误触且占地）
    modifyMenus: true,             // 精简长按菜单
    removeRelateItem: true,        // 移除评论区“相关内容”
    removeRecommendItem: true,     // 移除评论区“推荐内容”
    removeRewardItem: true,        // 移除打赏模块
    removeLiveMedia: true,         // 移除首页顶部直播
    removeNextVideo: true,         // 【关键】关闭自动播放下一个视频（非常省流量和电）
    removePinedTrending: true,     // 移除热搜置顶
    removeInterestFriendInTopic: true, 
    removeInterestTopic: true,
    removeUnfollowTopic: true,
    removeInterestUser: true,      // 移除可能感兴趣的人
    removeLvZhou: true,            // 移除绿洲
    removeSearchWindow: true,      // 移除搜索页浮窗
    
    // 下面两项设置为null，彻底关闭皮肤和图标逻辑
    profileSkin1: null,
    profileSkin2: null
}

// 菜单配置：只保留核心功能，减少对象遍历
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

const modifyCardsUrls = ['/cardlist', 'video/community_tab', '/searchall'];
const modifyStatusesUrls = ['statuses/friends/timeline', 'statuses/unread_friends_timeline', 'statuses/unread_hot_timeline', 'groups/timeline'];

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
    '/2/page?': 'removePage',
    '/statuses/container_timeline_topic?': 'topicHandler',
    '/statuses/container_timeline?': 'removeMain',
    '/statuses/container_timeline_unread': 'removeMain',
    '/statuses/container_timeline_hot?': 'removeMain',
    '/statuses/repost_timeline': 'removeRepost'
}

let url = $request.url;
let body = $response.body;
// 快速检查：如果不是JSON直接返回，节省解析时间
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
        // 出错直接返回原数据，不阻塞
        console.log("Weibo Script Error");
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

function isAd(data) {
    if (!data) return false;
    if (data.mblogtypename?.includes('广告') || data.mblogtypename?.includes('热推')) return true;
    if (data.promotion?.type === 'ad') return true;
    if (data.content_auth_info?.content_auth_title?.includes("广告")) return true;
    if (data.ads_material_info?.is_ads) return true;
    if (data.is_ad === 1) return true;
    return false;
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

function removeMain(data) {
    if (!data.items) return data;
    let newItems = [];
    for (let item of data.items) {
        if (checkJunkTopic(item)) continue;
        if (!isAd(item.data)) {
            // 移除图片对象中的无用字段，减小体积 (可选，为了极致性能保留原逻辑但移除日志)
            if (item.data?.pic_infos) {
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
            if(item.data?.extend_info) {
                 delete item.data.extend_info.shopwindow_cards;
                 delete item.data.extend_info.ad_semantic_brand;
            }
            if (item.data?.semantic_brand_params) delete item.data.semantic_brand_params;
            if (item.data?.common_struct) delete item.data.common_struct;
            newItems.push(item);
        }
    }
    data.items = newItems;
    return data;
}

function topicHandler(data) {
    const items = data.items;
    if (!items) return data;
    if (!mainConfig.removeUnfollowTopic) return data;
    let newItems = [];
    for (let c of items) {
        let addFlag = true;
        let category = c.category;
        if (category === 'feed') {
            let btns = c?.data?.buttons;
            if (btns && btns.length > 0 && btns[0].type === 'follow') addFlag = false;
        } else if (category === 'group') {
             const cc = c.header?.title?.content;
             if (cc && cc.indexOf('空降发帖') > -1) addFlag = false;
             // 省略了复杂的子项检查，直接保留非广告项，降低CPU消耗
        } else if (category === 'card') {
            if (c.data?.top?.title === '正在活跃' || (c.data?.card_type === 200 && c.data?.group) || c.data?.itemid.indexOf('infeed_may_interest_in') > -1) addFlag = false;
        }
        if (addFlag) newItems.push(c);
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
            if (!isAd(item.data)) newItems.push(item);
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

function removePage(data) {
    removeCards(data);
    if (mainConfig.removePinedTrending && data.cards && data.cards.length > 0 && data.cards[0].card_group) {
        data.cards[0].card_group = data.cards[0].card_group.filter(c => !c.itemid.includes("t:51"));
    }
    return data;
}

function removeCards(data) {
    if (!data.cards) return;
    let newCards = [];
    for (const card of data.cards) {
        let cardGroup = card.card_group;
        if (cardGroup && cardGroup.length > 0) {
            let newGroup = cardGroup.filter(group => group.card_type !== 118);
            card.card_group = newGroup;
            newCards.push(card);
        } else {
            if ([9, 165].indexOf(card.card_type) > -1) {
                if (!isAd(card.mblog)) newCards.push(card);
            } else {
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
    if (mainConfig.removeInterestTopic && data.itemid) {
        if (data.itemid.indexOf('infeed_may_interest_in') > -1 || data.itemid.indexOf('infeed_friends_recommend') > -1) data.card_group = [];
    }
}
function userHandler(data) {
    data = removeMain(data);
    if (!mainConfig.removeInterestUser || !data.items) return data;
    data.items = data.items.filter(item => {
        if (item.category === 'group') {
             try { if (item.items[0]['data']['desc'] === '可能感兴趣的人') return false; } catch (e) {}
        }
        return true;
    });
    return data;
}
function nextVideoHandler(data) {
    if (mainConfig.removeNextVideo) { data.statuses = []; data.tab_list = []; }
}
function removeVideoRemind(data) {
    data.bubble_dismiss_time = 0; data.exist_remind = false; data.image_dismiss_time = 0;
    data.image = ''; data.tag_image_english = ''; data.tag_image_english_dark = ''; data.tag_image_normal = ''; data.tag_image_normal_dark = '';
}
function itemExtendHandler(data) {
    if ((mainConfig.removeRelate || mainConfig.removeGood) && data.trend?.titles) {
        let title = data.trend.titles.title;
        if ((mainConfig.removeRelate && title === '相关推荐') || (mainConfig.removeGood && title === '博主好物种草')) delete data.trend;
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

// 极其精简的 Env 类，仅保留 Quantumult X 所需部分
function Env(t) {
    this.name = t;
    this.logs = [];
    this.isMute = false;
    this.log = (...t) => { if(mainConfig.isDebug) console.log(t.join("\n")); };
    this.done = (t = {}) => { $done(t); };
}
