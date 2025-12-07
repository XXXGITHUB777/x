/**
 * @date 2025-12-07
 */

const version = 'v3.0.Ultimate';

// 开关配置：默认全开
const config = {
    isDebug: false,                // 关闭日志以节省 I/O 消耗
    removeHomeVip: true,           // 个人中心 VIP 条
    removeHomeCreatorTask: true,   // 创作者任务
    removeRelate: true,            // 详情页相关推荐
    removeGood: true,              // 详情页博主好物种草
    removeFollow: true,            // 详情页关注博主推荐
    removeLiveMedia: true,         // 首页顶部直播
    removeInterestTopic: true,     // 移除感兴趣的超话/好友
    removeUnfollowTopic: true,     // 移除未关注超话
    enhancePic: true               // 开启图片高清 (虽耗流量但提升体验)
};

// ================= 核心路由分发 =================
// 使用 Map 结构代替长 if-else 链，O(1) 复杂度
const url = $request.url;
const body = $response.body;

// 快速检查：如果不是 JSON 格式，直接返回，避免解析消耗
if (!body || (body[0] !== '{' && body.trim()[0] !== '{')) {
    $done({});
} else {
    // 路由映射表：URL 关键词 -> 处理函数
    const handlerMap = {
        '/profile/me': removeHome,
        '/statuses/extend': itemExtendHandler, // 详情页
        '/video/remind_info': removeVideoRemind,
        '/live/media_homelist': removeMediaHomelist,
        '/comments/build_comments': removeComments,
        '/comments/mix_comments': removeComments,
        '/search/finder': removeSearchMain, // 发现页-热搜核心
        '/search/container_timeline': removeSearch,
        '/search/container_discover': removeSearch,
        '/2/messageflow': removeMsgAd,
        '/statuses/container_timeline_topic': topicHandler,
        '/statuses/container_timeline_topicpage': topicHandler,
        // 以下全部走通用信息流清理
        '/statuses/container_timeline': removeFeed,
        '/statuses/container_timeline_hot': removeFeed,
        '/statuses/unread_friends_timeline': removeFeed,
        '/statuses/friends/timeline': removeFeed,
        '/groups/timeline': removeFeed,
        '/cardlist': removeCards,
        '/page': removePage,
        '/searchall': removePage
    };

    try {
        let processed = false;
        const resp_data = JSON.parse(body);

        // 遍历 Map 寻找匹配的处理器
        for (const [path, handler] of Object.entries(handlerMap)) {
            if (url.includes(path)) {
                handler(resp_data);
                processed = true;
                break;
            }
        }

        // 如果没有匹配到特定路由，但包含 items 或 cards，做一次通用兜底清理
        if (!processed && (resp_data.items || resp_data.cards)) {
             removeCards(resp_data);
        }

        $done({ body: JSON.stringify(resp_data) });

    } catch (e) {
        // 出错时直接返回原数据，保证 App 不崩
        if (config.isDebug) console.log(`Error: ${e.message}`);
        $done({});
    }
}

// ================= 逻辑处理函数 =================

// 1. 核心广告判断逻辑 (整合了多个脚本的特征)
function isAd(data) {
    if (!data) return false;
    // 关键字匹配
    if (data.mblogtypename === '广告' || data.mblogtypename === '热推') return true;
    if (data.content_auth_info?.content_auth_title === '广告') return true;
    if (data.promotion?.type === 'ad') return true;
    if (data.is_ad === 1 || data.ad_state === 1) return true;
    
    // 字段特征匹配
    if (data.ads_material_info?.is_ads) return true;
    
    // itemid 特征匹配 (这种字符串匹配最耗时，放在最后)
    if (data.itemid) {
        if (data.itemid.includes("is_ad_pos")) return true;
        if (data.itemid.includes("cate_type:tongcheng")) return true; // 同城广告
        if (data.itemid.includes("ad_video")) return true;
    }
    return false;
}

// 2. 清理单个微博对象 (去杂质 + 高清图)
function cleanItem(item) {
    if (!item) return null;
    let data = item.data || item; // 兼容不同结构
    
    // 如果是广告，直接标记删除
    if (isAd(data)) return null;

    // 移除不必要的推广字段 (节省内存)
    if (data.extend_info) {
        delete data.extend_info.shopwindow_cards;    // 橱窗
        delete data.extend_info.ad_semantic_brand;   // 品牌
    }
    delete data.semantic_brand_params;
    delete data.common_struct;
    delete data.ad_tag_nature;

    // 图片高清化 (针对 City Boy 对视觉的高要求)
    if (config.enhancePic && data.pic_infos) {
        for (let key in data.pic_infos) {
            let p = data.pic_infos[key];
            if (p?.original?.url) {
                let high_url = p.original.url.replace(/orj\d+|mw\d+/, "oslarge"); // 替换缩略图规则
                p.largest = { url: high_url };
                p.thumbnail = { url: high_url };
                p.bmiddle = { url: high_url };
                p.large = { url: high_url };
            }
        }
    }
    return item;
}

// 3. 首页/信息流处理
function removeFeed(data) {
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    if (data.trends) delete data.trends;

    // 处理 statuses 数组
    if (data.statuses && data.statuses.length > 0) {
        let keep = [];
        for (let s of data.statuses) {
            if (cleanItem(s)) keep.push(s);
        }
        data.statuses = keep;
    }

    // 处理 items 数组 (推荐流)
    if (data.items && data.items.length > 0) {
        removeCards(data); // items 结构和 cards 类似，复用逻辑
    }
}

// 4. 卡片流通用处理 (适用于 search, page, items)
function removeCards(data) {
    let list = data.cards || data.items;
    if (!list) return;

    let newList = [];
    for (let item of list) {
        // 1. 过滤 Banner 和 推广
        if (item.itemid && (item.itemid.includes("banner") || item.itemid.includes("is_ad_pos"))) continue;
        // 2. 过滤具体内容是广告的
        if (isAd(item.data || item.mblog)) continue;

        // 3. 处理 category (feed, card, group)
        let category = item.category;
        
        // 特殊：发现页的轮播图等
        if (category === 'group') {
             // 移除掉不需要的 group，比如 "空降发帖"
             if (item.header?.title?.content?.includes('空降')) continue;
        }

        // 4. 处理 card_group (卡片组内部的广告)
        if (item.card_group) {
            item.card_group = item.card_group.filter(c => {
                if (c.card_type === 118) return false; // 横版广告
                if (c.card_type === 182) return false; // 热议话题广告
                if (c.promotion || isAd(c)) return false;
                return true;
            });
            if (item.card_group.length === 0) continue; // 如果组空了，整个移除
        }

        // 5. 递归处理子 items
        if (item.items) {
             let subList = [];
             for (let sub of item.items) {
                 if (!isAd(sub.data)) {
                     // 移除 "可能感兴趣的人" 等干扰项
                     if (sub.data?.desc === '可能感兴趣的人' && config.removeInterestTopic) continue;
                     cleanItem(sub);
                     subList.push(sub);
                 }
             }
             item.items = subList;
        }

        // 6. 清理自身数据
        if (item.data) cleanItem({data: item.data});
        
        newList.push(item);
    }
    
    if (data.cards) data.cards = newList;
    if (data.items) data.items = newList;
}

// 5. 发现页 (热搜) 特殊处理 - 移植自你的 weibo_ads.js
function removeSearchMain(data) {
    let channels = data.channelInfo?.channels;
    if (channels) {
        // 只保留核心 Tab：发现(1001), 榜单(1016) 等
        let validIds = [1001, 1015, 1016]; 
        data.channelInfo.channels = channels.filter(c => validIds.includes(c.id));
        
        // 深度清理 payload
        for (let c of data.channelInfo.channels) {
            if (c.payload) {
                if (c.payload.loadedInfo?.searchBarContent) delete c.payload.loadedInfo.searchBarContent; // 正在搜
                removeCards(c.payload);
            }
        }
    }
    // 头部 Banner 广告
    if (data.header?.data?.items) {
        removeCards({items: data.header.data.items});
    }
}

function removeSearch(data) {
    if (data.loadedInfo?.searchBarContent) delete data.loadedInfo.searchBarContent;
    removeCards(data);
}

// 6. 详情页处理
function itemExtendHandler(data) {
    if (config.removeRelate && data.trend?.titles?.title === '相关推荐') delete data.trend;
    if (config.removeGood && data.trend?.titles?.title === '博主好物种草') delete data.trend;
    if (config.removeFollow) data.follow_data = null;
    if (data.reward_info) data.reward_info = null; // 打赏模块
    if (data.page_alerts) data.page_alerts = null; // 弹窗警告
}

// 7. 评论区处理
function removeComments(data) {
    if (!data。datas) return;
    data.datas = data.datas.filter(item => {
        if (item。adType === '广告') return false;
        if (item。adType === '相关内容' && config。removeRelate) return false;
        if (item。adType === '推荐' && config。removeRelate) return false;
        return true;
    });
}

// 8. 个人主页处理
function removeHome(data) {
    if (!data.items) return;
    data。items = data。items。filter(item => {
        let id = item.itemId;
        if (id === 'profileme_mine') {
            if (config。removeHomeVip && item。header) item.header。vipView = null;
            return true;
        }
        // 移除 广告图、新人任务、VIP开通、粉丝群等垃圾入口
        if (['100505_-_top8'， '100505_-_newusertask'， '100505_-_vipkaitong'， '100505_-_adphoto']。includes(id)) return false;
        return true;
    });
}

// 9. 超话处理
function topicHandler(data) {
    if (!data.items) return;
    data。items = data。items。filter(item => {
        if (isAd(item。data)) return false;
        if (config。removeUnfollowTopic && item。category === 'feed') {
             // 逻辑：如果这个超话feed里包含“关注”按钮，说明我没关注，删掉
             if (item。data?.buttons?.[0]?.输入 === 'follow') return false;
        }
        return true;
    });
}

// 辅助：移除气泡/红点
function removeVideoRemind(data) { 
    data.bubble_dismiss_time = 0; 
    data.exist_remind = false; 
    data.image = ''; 
}
function removeMediaHomelist(data) { 
    if (config.removeLiveMedia) data.data = {}; 
}
function removeMsgAd(data) { 
    if (data.messages) data.messages = data.messages.filter(m => !m.msg_card?.ad_tag); 
}
function removePage(data) {
    removeCards(data);
    // 移除热搜置顶
    if (data.cards && data.cards[0]?.card_group) {
        data.cards[0].card_group = data.cards[0].card_group.filter(c => !c.itemid.includes("t:51"));
    }
}
