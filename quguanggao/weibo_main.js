

const $ = new Env("微博去广告Fusion");

const mainConfig = {
    isDebug: false,                // 【关键】关闭日志，拒绝发热
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
    removeNextVideo: true,
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

const itemMenusConfig = {
    creator_task: false, mblog_menus_custom: false, mblog_menus_video_later: true,
    mblog_menus_comment_manager: true, mblog_menus_avatar_widget: false, mblog_menus_card_bg: false,
    mblog_menus_long_picture: true, mblog_menus_delete: true, mblog_menus_edit: true,
    mblog_menus_edit_history: true, mblog_menus_edit_video: true, mblog_menus_sticking: true,
    mblog_menus_open_reward: false, mblog_menus_novelty: false, mblog_menus_favorite: true,
    mblog_menus_promote: false, mblog_menus_modify_visible: true, mblog_menus_copy_url: true,
    mblog_menus_follow: true, mblog_menus_video_feedback: false, mblog_menus_shield: true,
    mblog_menus_report: true, mblog_menus_apeal: false, mblog_menus_home: true
}

// 路由映射 (包含原版 ads.js 和 main.js 的所有关键接口)
const urlHandlers = {
    '/profile/me': removeHome,
    '/statuses/extend': itemExtendHandler,
    '/video/remind_info': removeVideoRemind,
    '/checkin/show': removeCheckin,
    '/live/media_homelist': removeMediaHomelist,
    '/comments/build_comments': removeComments,
    '/comments/mix_comments': removeComments,
    '/container/get_item': containerHandler,
    '/profile/container_timeline': userHandler,
    '/video/tiny_stream_video_list': nextVideoHandler,
    '/2/statuses/video_mixtimeline': nextVideoHandler,
    '/search/finder': removeSearchMain,
    '/search/container_timeline': removeSearch,
    '/search/container_discover': removeSearch,
    '/2/messageflow': removeMsgAd,
    '/statuses/container_timeline_topic': topicHandler,       // 超话Tab
    '/statuses/container_timeline_topicpage': topicHandler,   // 超话页面
    '/statuses/container_timeline': removeFeed,               // 首页推荐
    '/statuses/container_timeline_unread': removeFeed,
    '/statuses/container_timeline_hot': removeFeed,           // 热门
    '/groups/timeline': removeFeed,                           // 分组
    '/statuses/friends/timeline': removeFeed,                 // 关注流
    '/statuses/unread_friends_timeline': removeFeed,
    '/statuses/unread_hot_timeline': removeFeed,
    '/statuses/repost_timeline': removeRepost,
    '/cardlist': removeCards,
    '/page': removePage,                                      // 热搜/Page
    '/flowpage': removePage,
    '/searchall': removePage,
    'video/community_tab': removeCards
};

let url = $request.url;
let body = $response.body;

if (!body || body.indexOf('{') === -1) {
    $.done({});
} else {
    try {
        let handler = null;
        for (let key in urlHandlers) {
            if (url.indexOf(key) > -1) {
                handler = urlHandlers[key];
                break;
            }
        }
        if (handler) {
            let data = JSON.parse(body);
            handler(data);
            $.done({body: JSON.stringify(data)});
        } else {
            $.done({});
        }
    } catch (e) {
        // 屏蔽错误，防止断网
        $.done({});
    }
}

// 【核心】融合了 fmz200 和 Cherish 的所有广告判定逻辑
function isAd(data) {
    if (!data) return false;
    
    // 1. 显性广告标识 (Cherish & fmz200)
    if (data.mblogtypename === '广告' || data.mblogtypename === '热推') return true;
    if (data.content_auth_info?.content_auth_title === '广告') return true;
    if (data.promotion?.type === 'ad') return true;
    if (data.is_ad === 1 || data.ad_state === 1) return true;
    if (data.ads_material_info?.is_ads) return true;
    
    // 2. 隐性广告标识 (来自 weibo_ads.js 的关键逻辑)
    if (data.itemid) {
        if (data.itemid.includes("is_ad_pos")) return true;
        if (data.itemid.includes("cate_type:tongcheng")) return true; // 同城推广
        if (data.itemid.includes("ad_video")) return true;
    }
    
    return false;
}

// 【核心】深度清洗 (来自 weibo_ads.js deleteCommonAndSemanticBrandParams)
// 必须清理 shopwindow_cards 才能去掉“博主好物种草”等牛皮癣
function cleanItem(item) {
    if (!item) return null;
    let data = item.data || item;
    
    if (isAd(data)) return null;

    // 清理推广字段
    if (data.extend_info) {
        delete data.extend_info.shopwindow_cards;    // 橱窗
        delete data.extend_info.ad_semantic_brand;   // 品牌
    }
    if (data.semantic_brand_params) delete data.semantic_brand_params;
    if (data.common_struct) delete data.common_struct; // 通用结构，常含绿洲/活动
    if (data.ad_tag_nature) delete data.ad_tag_nature;
    
    // 图片高清化 (保留优化)
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

// 处理 Feed 流 (关注、推荐、分组)
function removeFeed(data) {
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    if (data.trends) delete data.trends; // 详情页的相关推荐

    if (data.statuses) {
        let newStatuses = [];
        for (let s of data.statuses) {
            let clean = cleanItem(s);
            if (clean) newStatuses.push(clean);
        }
        data.statuses = newStatuses;
    }
    
    if (data.items) {
        let newItems = [];
        for (let item of data.items) {
            // 过滤推荐超话/视频卡片 (来自 weibo_main.js checkJunkTopic)
            if (item.category === 'group') {
                 if(['super_topic_recommend_card', 'recommend_video_card'].includes(item.trend_name)) continue;
            }
            // 过滤广告
            let clean = cleanItem(item);
            if (clean) newItems.push(clean);
        }
        data.items = newItems;
    }
}

// 处理搜索/热搜 Page (融合 weibo_ads.js 的复杂逻辑)
function removePage(data) {
    // 移除置顶热搜
    if (mainConfig.removePinedTrending && data.cards && data.cards.length > 0) {
        if (data.cards[0].card_group) {
            data.cards[0].card_group = data.cards[0].card_group.filter(c => !c.itemid.includes("t:51"));
        }
    }
    
    // 移除Banner
    if (data.pageHeader) data.pageHeader = {};

    removeCards(data);
}

// 通用卡片处理 (热搜、话题、搜索)
function removeCards(data) {
    if (!data.cards && !data.items) return;
    let list = data.cards || data.items;
    let newList = [];

    for (let card of list) {
        // 1. 过滤整个卡片
        if (card.itemid && card.itemid.includes("banner")) continue;
        if (isAd(card.data || card.mblog)) continue;
        
        // 2. 深入卡片内部处理 card_group (来自 weibo_ads.js removeCommonAds)
        // 针对 card_type 17(热搜), 235(新热搜), 101(热门) 的特殊处理
        let cardType = card.card_type || card.data?.card_type;
        
        // 移除横版图片广告(118)、内嵌模块
        if (card.card_group) {
            card.card_group = card.card_group.filter(g => {
                if (g.card_type === 118) return false;
                if (g.promotion || isAd(g)) return false;
                if (g.itemid?.includes("is_ad_pos")) return false; 
                return true;
            });
            if (card.card_group.length === 0) continue; // 空组移除
        }

        // 针对热搜列表内部数组 (group / channel_list)
        if (cardType === 17 && card.data?.group) {
            card.data.group = card.data.group.filter(g => !g.itemid?.includes("is_ad_pos") && !g.promotion);
        }
        if (cardType === 235 && card.data?.channel_list) {
            // 很多热搜广告藏在这里
             card.data.channel_list = card.data.channel_list.filter(c => !c.promotion);
        }

        // 3. 话题页面的 items 处理
        if (card.items) {
             let newSubItems = [];
             for(let sub of card.items) {
                 if (isAd(sub.data)) continue;
                 // 递归清理
                 if (sub.items) {
                     sub.items = sub.items.filter(ss => !isAd(ss.data));
                 }
                 newSubItems.push(cleanItem(sub));
             }
             card.items = newSubItems;
        }

        // 4. 清理自身杂项
        if (card.data) cleanItem({data: card.data});
        newList.push(card);
    }
    
    if (data.cards) data.cards = newList;
    if (data.items) data.items = newList;
}

// 处理超话 (融合 weibo_main.js 的强力过滤)
function topicHandler(data) {
    const items = data.items;
    if (!items) return;
    if (!mainConfig.removeUnfollowTopic) return;

    let newItems = [];
    for (let c of items) {
        if (isAd(c.data)) continue;
        
        let category = c.category;
        
        // 过滤“空降发帖”、“正在活跃”等干扰项 (Cherish 逻辑)
        if (category === 'group') {
             if (c.header?.title?.content?.includes('空降')) continue;
             if (c.items) {
                 // 移除特定ID的干扰子项
                 c.items = c.items.filter(sub => {
                     let aid = sub?.itemExt?.anchorId;
                     if (!aid) return true;
                     return !['sg_bottom_tab_search_input', 'chaohua_discovery_banner_1'].includes(aid);
                 });
             }
        } else if (category === 'card') {
             let title = c.data?.top?.title;
             if (title === '正在活跃') continue;
             if (c.data?.itemid?.includes('infeed_may_interest_in')) continue; // 感兴趣
        }
        
        newItems.push(c);
    }
    data.items = newItems;
}

// 发现页/搜索页 顶部处理 (来自 weibo_ads.js)
function removeSearchMain(data) {
    let channels = data.channelInfo?.channels;
    if (channels) {
        // 移除多余Tab (只保留 1001发现 等核心)
        let validIds = [1001, 1015, 1016, 1040, 1041, 1043];
        data.channelInfo.channels = channels.filter(c => validIds.includes(c.id));
        
        for (let c of data.channelInfo.channels) {
            if (c.payload) removeSearch(c.payload);
        }
    }
}

function removeSearch(data) {
    if (!data.items) return;
    // 搜索栏“大家正在搜”
    if (data.loadedInfo?.searchBarContent) delete data.loadedInfo.searchBarContent;
    
    // 复用通用的卡片清理逻辑
    removeCards(data);
}

// 评论区
function removeComments(data) {
    let del = ['广告'];
    if (mainConfig.removeRelateItem) del.push('相关内容', '相关评论');
    if (mainConfig.removeRecommendItem) del.push('推荐', '热推');
    
    if (data.datas) {
        data.datas = data.datas.filter(i => {
            if (isAd(i.data)) return false;
            if (del.includes(i.adType)) return false;
             // 过滤特定用户评论 (如“超话社区”发的广告)
            if (i.data?.user && ["超话社区", "微博视频"].includes(i.data.user.name)) return false;
            return true;
        });
    }
}

// 辅助功能
function removeHome(data) {
    if (!data.items) return;
    data。items = data。items。filter(item => {
        let id = item.itemId;
        if (id === 'profileme_mine') {
            if (mainConfig。removeHomeVip && item。header) item.header。vipView = null;
            return true;
        }
        // 移除各种金刚位广告
        if (['100505_-_top8'， 'mine_attent_title'， '100505_-_newusertask'， '100505_-_vipkaitong'， '100505_-_adphoto']。includes(id)) return false;
        if (id。match(/100505_-_meattent_-_\d+/)) return false;
        return true;
    });
}
function removeCheckin(data) { data.show = 0; }
function removeMediaHomelist(data) { if (mainConfig.removeLiveMedia) data.data = {}; }
function containerHandler(data) {
    if (mainConfig。removeInterestFriendInTopic && data。card_type_name === '超话里的好友') data.card_group = [];
    if (mainConfig。removeInterestTopic && data。itemid && (data。itemid。includes('infeed_may_interest_in') || data.itemid.includes('infeed_friends_recommend'))) data.card_group = [];
}
function userHandler(data) {
    removeFeed(data);
    if (mainConfig。removeInterestUser && data。items) {
        data。items = data.items.filter(i => !(i.category === 'group' && i.items && i.items[0]?.data?.desc === '可能感兴趣的人'));
    }
}
function nextVideoHandler(data) { if (mainConfig.removeNextVideo) { data.statuses = []; data.tab_list = []; } }
function removeVideoRemind(data) { data.bubble_dismiss_time = 0; data.exist_remind = false; data.image_dismiss_time = 0; data.image = ''; }
function removeMsgAd(data) { if (data.messages) data.messages = data.messages.filter(m => !m.msg_card?.ad_tag); }
function removeRepost(data) { if (data.reposts) data.reposts = data.reposts.filter(i => !isAd(i)); }
function itemExtendHandler(data) {
    if (mainConfig.removeRelate && data.trend?.titles?.title === '相关推荐') delete data.trend;
    if (mainConfig.removeGood && data.trend?.titles?.title === '博主好物种草') delete data.trend;
    if (mainConfig.removeFollow) data.follow_data = null;
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

function Env(t) { this.done = (t) => $done(t); }
