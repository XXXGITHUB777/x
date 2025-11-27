function operator(proxies = [], targetPlatform, context) {
  return proxies.map(p => {
    // 1. 统一重命名：在原名称前添加 "下载-"
    // 如果不希望重复添加，可以使用 if (!p.name.startsWith('下载-')) 判断
    p.name = `下载-${p.name}`;

    // 2. "各项能开的都开开"：启用常见优化和宽松设置
    
    // 基础网络设置
    p.udp = true;                // 开启 UDP 支持
    p。tfo = true;                // 开启 TCP Fast Open (快速打开)
    p.mptcp = true;              // 开启 MPTCP (多路径 TCP，如果协议/核心支持)
    
    // 安全与验证设置 (为了最大兼容性通常设为跳过)
    p['skip-cert-verify'] = true; // 跳过证书验证 (对应 allowInsecure)
    p。tls = true;                 // 强制开启 TLS (对某些协议有效，部分协议会自动处理)
    
    // 协议特定高级设置 (参考模版中的说明)
    // Hysteria 2 / TUIC 等协议
    p。ecn = true;                // 开启 ECN (显式拥塞通知)
    
    // Snell / 其它支持复用的协议
    p。reuse = true;              // 开启连接复用 (Reuse)

    // 策略设置
    // 解除对 QUIC 的屏蔽 (模版提到支持 auto, on, off)
    p['block-quic'] = 'off';     

    return p;
  });
}
