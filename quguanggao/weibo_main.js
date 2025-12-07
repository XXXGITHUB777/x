

// 1. 【物理静默】重写 console.log 为空函数，彻底杜绝日志发热
const console = { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };

// 2. 【核心配置】默认全部开启“最强模式”
const config = {
    keepFollow: true,      // 保留关注按钮 (设为 false 会连关注按钮都去掉，太极致了不建议)
    enhancement: true,     // 启用图片高清化 (City Boy 必备)
};

// -----------------------------------------------------------
// 路由分发 (极速匹配)
// -----------------------------------------------------------
const url = $request.url;
const method = getMethod(url);
if (method) {
    try {
        const body = JSON.parse($response.body);
        method(body);
        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({}); // 解析失败直接放行，防止卡死
    }
} else {
    $done({});
}

function getMethod(url) {
    if (url.includes('/profile/me')) return cleanProfile; // 个人主页
    if (url.includes('/statuses/extend')) return cleanStatus; // 微博详情
    if (url.includes('/comments/')) return cleanComments; // 评论区 (混合/普通)
    if (url.includes('/search/finder')) return cleanFinder; // 发现页
    if (url.includes('/search/container_')) return cleanSearch; // 搜索结果
    if (url.includes('/messageflow')) return cleanMessage; // 消息列表
    if (url.includes('/statuses/container_timeline_topic')) return cleanTopic; // 超话
    // 通用流 (首页、热搜流、好友流等)
    if (url.includes('/statuses/') || url.includes('/groups/') || url.includes('/cardlist') || url.includes('/page')) return cleanFeed;
    return null;
}

// -----------------------------------------------------------
// 极致清理逻辑 (Nuclear Logic)
// -----------------------------------------------------------

// 1. 通用信息流清理 (首页、热搜、列表)
function cleanFeed(data) {
    // 移除顶部轮播、广告对象
    if (data.ad) delete data.ad;
    if (data.advertises) delete data.advertises;
    if (data.trends) delete data.trends;
    if (data.pageHeader) delete data.pageHeader; // 干掉热搜页顶部的Banner

    // 两个主要的列表字段：items 和 cards
    if (data.items) data.items = processItems(data.items);
    if (data.cards) data.cards = processItems(data.cards);
    
    // 状态流
    if (data.statuses) {
        data.statuses = data.statuses.filter(item => !isAd(item));
        if (config.enhancement) data.statuses.forEach(enhancePic);
    }
}

// 2. 核心处理函数：处理 Items/Cards 数组
function processItems(list) {
    if (!list) return [];
    const keepList = [];
    
    for (let item of list) {
        // --- 第一层过滤：基于 itemid 和 category ---
        const id = item.itemid || "";
        // 杀掉所有 Banner、广告位、推广、同城
        if (id.match(/banner|is_ad_pos|ad_video|tongcheng|t:51/)) continue; 
        // 杀掉“大家正在搜”、“热议”等干扰项
        if (id.includes('finder_window') || id.includes('more_frame')) continue;

        // --- 第二层过滤：基于内容特征 ---
        if (isAd(item.data || item.mblog || item)) continue;

        // --- 第三层过滤：处理 card_group (卡片组) ---
        if (item.card_group) {
            item.card_group = item.card_group.filter(sub => {
                if (sub.card_type === 118) return false; // 横版图片广告
                if (sub.card_type === 182) return false; // 强行插入的“热议”
                if (sub.itemid && sub.itemid.match(/is_ad_pos|promotion/)) return false;
                if (isAd(sub)) return false;
                return true;
            });
            if (item.card_group.length === 0) continue; // 组空了就整条删
        }

        // --- 第四层过滤：特殊类型 ---
        // 移除“可能感兴趣的人”
        if (item.category === 'group') {
             const desc = item.items?.[0]?.data?.desc;
             if (desc === '可能感兴趣的人' || desc === '推荐') continue;
        }

        // --- 数据净化 (省内存) ---
        const d = item.data || item.mblog;
        if (d) {
            // 移除商品橱窗、品牌标、推广tag
            if (d.extend_info) delete d.extend_info; 
            if (d.common_struct) delete d.common_struct;
            if (d.semantic_brand_params) delete d.semantic_brand_params;
            if (config.enhancement) enhancePic(d);
        }

        keepList.push(item);
    }
    return keepList;
}

// 3. 广告判定 (白名单思维：只放行干净的)
function isAd(data) {
    if (!data) return false;
    if (data.mblogtypename === '广告' || data.mblogtypename === '热推') return true;
    if (data.promotion?.type === 'ad') return true;
    if (data.content_auth_info?.content_auth_title === '广告') return true;
    if (data.ads_material_info?.is_ads) return true;
    if (data.is_ad === 1) return true;
    return false;
}

// 4. 图片高清化 (City Boy 视觉优化)
function enhancePic(data) {
    if (!data.pic_infos) return;
    for (let k in data.pic_infos) {
        let p = data.pic_infos[k];
        if (p?.original?.url) {
            // 简单粗暴：全部替换为最大图
            const hd = p.original.url.replace(/orj\d+|mw\d+/, "oslarge");
            p.thumbnail = { url: hd };
            p.bmiddle = { url: hd };
            p.large = { url: hd };
            p.largest = { url: hd };
        }
    }
}

// 5. 个人主页 (只留我的微博)
function cleanProfile(data) {
    if (!data.items) return;
    data.items = data.items.filter(item => {
        // 只保留“我的个人信息”和“微博列表”
        // 杀掉：VIP中心、任务、推广、红包、粉丝群、点赞记录
        if (item.itemId === 'profileme_mine') {
            if (item.header) item.header.vipView = null; // 去掉VIP背景
            return true;
        }
        // 除了微博流，其他基本都是垃圾
        if (item.category === 'card') return false; 
        return true;
    });
}

// 6. 微博详情页 (极致纯净)
function cleanStatus(data) {
    // 杀掉“相关推荐”、“博主好物”
    delete data.trend; 
    delete data.reward_info; // 杀掉打赏
    delete data.follow_data; // 杀掉顶部关注条
    delete data.page_alerts; // 杀掉弹窗
    if (data.custom_action_list) {
        // 菜单只保留：转发、评论、点赞、编辑、删除
        data.custom_action_list = data.custom_action_list.filter(i => 
            ['mblog_menus_delete', 'mblog_menus_edit', 'mblog_menus_create_share', 'mblog_menus_favorite'].includes(i.type)
        );
    }
}

// 7. 评论区 (只留人话)
function cleanComments(data) {
    if (data。datas) {
        data.datas = data.datas.filter(c => {
            // 杀掉广告、相关内容、推荐、热推
            if (['广告'， '相关内容'， '推荐'， '热推']。includes(c。adType)) return false;
            // 杀掉包含“关注博主”按钮的非评论项
            if (c.type === 6 || c.type === 15) return false;
            return true;
        });
    }
}

// 8. 发现页 (只留热搜榜单)
function cleanFinder(data) {
    if (data。channelInfo?.channels) {
        // 只保留 id: 1001 (发现)
        data。channelInfo。channels = data。channelInfo。channels。filter(c => c.id === 1001);
        if (data。channelInfo。channels[0]?.payload) {
            cleanFeed(data.channelInfo.channels[0].payload);
        }
    }
    // 杀掉顶部的所有Banner
    if (data。header) delete data。header;
}

// 9. 搜索结果
function cleanSearch(data) {
    if (data。loadedInfo) delete data.loadedInfo.searchBarContent; // 杀掉“猜你想搜”
    cleanFeed(data);
}

// 10. 消息页
function cleanMessage(data) {
    if (data.messages) {
        data.messages = data.messages.filter(m => !m.msg_card?.ad_tag); // 杀掉推广消息
    }
}

// 11. 超话
function cleanTopic(data) {
    if (data.items) {
        data.items = data.items.filter(item => {
            // 杀掉“未关注”的推荐流
            if (item.category === 'feed' && item.data?.buttons?.[0]?.type === 'follow') return false;
            return !isAd(item.data);
        });
    }
}
