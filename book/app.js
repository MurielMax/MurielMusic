/* ==========================================================================
 * app.js  |  留言反馈中心 —— 页面逻辑
 * 依赖：data.js（数据存储）+ style.css + index.html
 * 核心：广告过滤 -> 拦截进后台队列 -> 管理员放行 -> 时间轴公开展示
 *       管理员可自定义过滤规则；1 小时内同设备 / 同 IP 限 3 条
 * 彩蛋：连续点击「留言广场」5 次静默进入隐藏的审核后台
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------- 兜底数据：万一 data.js 未被加载，页面仍能运行 ---------- */
  var FALLBACK_CFG = {
    siteName: '回声 · 产品反馈中心',
    siteDesc: '每一条反馈都会被认真对待，时间轴记录产品成长的每一步',
    adminPasswordHash: '093ab158a6c85d31ace1394f2ac0bd0d5606e00bf94a940c47edcf6eaba15ba0',
    adminSalt: 'r7k2m9x4p6q1v8t3',
    hashIterations: 1000,
    secretClicks: 5,
    secretWindowMs: 2000,
    adScoreThreshold: 2,
    maxLength: 500,
    rateLimit: { enabled: true, windowMs: 3600000, max: 3, ipApi: '' },
    categories: [
      { key: 'feature', label: '功能建议', color: '#6366f1', bg: '#eef2ff' },
      { key: 'new', label: '新增需求', color: '#0284c7', bg: '#e0f2fe' },
      { key: 'bug', label: 'BUG 反馈', color: '#dc2626', bg: '#fee2e2' },
      { key: 'ux', label: '体验优化', color: '#d97706', bg: '#fef3c7' },
      { key: 'other', label: '其他', color: '#475569', bg: '#f1f5f9' }
    ],
    adRules: [
      { name: '营销推广词', score: 2, pattern: /(广告|推广|代购|加盟|代理|优惠券|免费领|扫码|返利|兼职|刷单)/i },
      { name: '站外联系方式', score: 2, pattern: /(微信|vx|qq|二维码|公众号)/i },
      { name: '手机号', score: 2, pattern: /1[3-9]\d{9}/i },
      { name: '网址/外链', score: 1, pattern: /(https?:\/\/|www\.)/i }
    ]
  };
  var FALLBACK_DATA = [
    {
      id: 'FBDEMO001', nickname: '示例用户', category: 'feature',
      content: '这是一条示例留言：时间轴按日期分组，支持分类筛选与关键词搜索。', contact: '',
      createdAt: '2026-11-11T10:00:00', status: 'approved', adScore: 0, adReasons: [],
      auditAt: '2026-11-11T10:01:00', auditor: '系统自动放行', reply: '', replyAt: ''
    },
    {
      id: 'FBDEMO002', nickname: '广告测试', category: 'other',
      content: '加微信领优惠券，限时推广，速来！', contact: '',
      createdAt: '2026-11-11T11:00:00', status: 'pending', adScore: 6,
      adReasons: ['营销推广词', '站外联系方式'], auditAt: '', auditor: '', reply: '', replyAt: ''
    }
  ];

  /* ---------- 常量与工具 ---------- */
  var CFG = window.FEEDBACK_CONFIG || FALLBACK_CFG;
  var INITIAL = (Array.isArray(window.FEEDBACK_DATA) && window.FEEDBACK_DATA.length)
    ? window.FEEDBACK_DATA : FALLBACK_DATA;
  var RATE = CFG.rateLimit || { enabled: true, windowMs: 3600000, max: 3, ipApi: '' };
  var KEY = 'feedback_store_v1';
  var MY_KEY = 'feedback_my_v1';
  var RULES_KEY = 'feedback_rules_v1';
  var THRESHOLD_KEY = 'feedback_threshold_v1';
  var DEVICE_KEY = 'feedback_device_v1';
  var RATE_KEY = 'feedback_rate_v1';
  var IP_KEY = 'feedback_ip_v1';
  var AUTH_KEY = 'feedback_auth_v1';
  var DEFAULT_SALT = 'r7k2m9x4p6q1v8t3';
  var DEFAULT_ITER = 1000;
  var J = JSON.stringify;
  var $ = function (s) { return document.querySelector(s); };

  function sGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function sDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nowISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  /* 容错：损坏/缺失的时间字段不参与排序时产生 NaN */
  function dObj(iso) {
    var d = new Date(String(iso || '').replace(' ', 'T'));
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  function fmtFull(iso) {
    var d = dObj(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dayKey(iso) {
    var d = dObj(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dayLabel(iso) {
    var d = dObj(iso);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((today - cur) / 86400000);
    var base = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (diff === 0) return '今天 · ' + base;
    if (diff === 1) return '昨天 · ' + base;
    return d.getFullYear() + '年' + base;
  }
  function genId() {
    var d = new Date(), id;
    do {
      id = 'FB' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        String(Math.floor(Math.random() * 900) + 100);
    } while (state.data.some(function (x) { return x.id === id; }));
    return id;
  }
  function catOf(key) {
    return (CFG.categories || []).find(function (c) { return c.key === key; }) ||
      { key: key, label: '其他', color: '#475569', bg: '#f1f5f9' };
  }
  function byTimeDesc(a, b) { return dObj(b.createdAt) - dObj(a.createdAt); }

  /* ---------- 口令哈希：加盐 + SHA-256 迭代，源码中不留明文 ---------- */
  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var SHA256_H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function utf8Bytes(s) {
    if (typeof TextEncoder === 'function') {
      return Array.prototype.slice.call(new TextEncoder().encode(s));
    }
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length &&
               s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
        var cp = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(i + 1) - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
                 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        i++;
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function sha256(str) {
    var bytes = utf8Bytes(String(str));
    var bits = bytes.length * 8;
    var hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
               (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = SHA256_H0.slice(), w = new Array(64), t;
    for (var off = 0; off < bytes.length; off += 64) {
      for (t = 0; t < 16; t++) {
        w[t] = ((bytes[off + 4 * t] << 24) | (bytes[off + 4 * t + 1] << 16) |
                (bytes[off + 4 * t + 2] << 8) | bytes[off + 4 * t + 3]) >>> 0;
      }
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var out = '';
    for (t = 0; t < 8; t++) out += ('00000000' + H[t].toString(16)).slice(-8);
    return out;
  }
  function hashPassword(pwd, salt, iterations) {
    var n = Math.max(1, Math.min(10000, Number(iterations) || DEFAULT_ITER));
    var x = String(salt == null ? '' : salt) + String(pwd == null ? '' : pwd);
    for (var i = 0; i < n; i++) x = sha256(x);
    return x;
  }
  function randomSalt() {
    try {
      var a = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(a);
      return Array.prototype.map.call(a, function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    } catch (e) {
      return String(Date.now()) + Math.random().toString(36).slice(2);
    }
  }
  /* 优先读改过的口令（本地），否则读数据文件；兼容旧版明文配置 */
  function authConfig() {
    var saved = sGet(AUTH_KEY);
    if (saved) {
      try { var o = JSON.parse(saved); if (o && o.hash) return o; } catch (e) {}
    }
    if (CFG.adminPasswordHash) {
      return {
        hash: String(CFG.adminPasswordHash),
        salt: String(CFG.adminSalt || ''),
        iterations: Number(CFG.hashIterations) || DEFAULT_ITER
      };
    }
    if (CFG.adminPassword) return { legacy: String(CFG.adminPassword) };
    return {
      hash: FALLBACK_CFG.adminPasswordHash,
      salt: FALLBACK_CFG.adminSalt,
      iterations: FALLBACK_CFG.hashIterations
    };
  }
  function checkPassword(input) {
    var a = authConfig();
    if (a.legacy) return String(input) === a.legacy;
    return hashPassword(input, a.salt, a.iterations) === a.hash;
  }

  /* ---------- 规则解析：关键词 / 正则 统一转成 RegExp ---------- */
  function makeRegExp(mode, raw, flags) {
    var f = flags || 'i';
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    try {
      if (mode === 'keyword') {
        var words = s.split(/[,，、;；\s]+/).filter(function (w) { return w; });
        if (!words.length) return null;
        return new RegExp(words.map(function (w) {
          return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('|'), f);
      }
      var m = s.match(/^\/([\s\S]*)\/([gimsuy]*)$/);
      if (m) return new RegExp(m[1], m[2] || f);
      return new RegExp(s, f);
    } catch (e) { return null; }
  }
  function normalizeRule(r) {
    r = r || {};
    var mode = r.mode === 'keyword' ? 'keyword' : 'regex';
    var p = r.pattern;
    var raw = r.raw;
    if (raw == null || raw === '') {
      if (p instanceof RegExp) raw = p.source;
      else {
        var s = String(p || '').trim();
        var m = s.match(/^\/([\s\S]*)\/([gimsuy]*)$/);
        raw = m ? m[1] : s;
      }
    }
    var flags = (p instanceof RegExp) ? p.flags : 'i';
    return {
      name: String(r.name || '未命名规则').slice(0, 20),
      score: Math.max(1, Math.min(10, Math.floor(Number(r.score) || 1))),
      mode: mode,
      raw: String(raw),
      pattern: makeRegExp(mode, raw, flags)
    };
  }
  function defaultRules() { return (CFG.adRules || []).map(normalizeRule); }
  function loadRules() {
    var raw = sGet(RULES_KEY);
    if (raw) {
      try { var a = JSON.parse(raw); if (Array.isArray(a)) return a.map(normalizeRule); } catch (e) {}
    }
    return defaultRules();
  }
  function saveRules() {
    sSet(RULES_KEY, J(state.rules.map(function (r) {
      return { name: r.name, score: r.score, mode: r.mode, raw: r.raw };
    })));
  }
  function loadThreshold() {
    var v = sGet(THRESHOLD_KEY);
    if (v !== null && v !== '') {
      var n = Math.floor(Number(v));
      if (n >= 1 && n <= 99) return n;
    }
    return Math.max(1, Number(CFG.adScoreThreshold) || 2);
  }
  function ruleText(r) { return r.pattern ? String(r.pattern) : '（表达式无效，规则不会生效）'; }

  /* ---------- 设备标识与提交频率限制 ---------- */
  function getDeviceId() {
    var id = sGet(DEVICE_KEY);
    if (id) return id;
    var raw = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      navigator.language || '',
      String(new Date().getTimezoneOffset()),
      navigator.platform || '',
      String(navigator.hardwareConcurrency || '')
    ].join('|');
    var h = 5381;
    for (var i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
    id = 'dev_' + h.toString(36);
    sSet(DEVICE_KEY, id);
    return id;
  }
  function loadRate() {
    var raw = sGet(RATE_KEY);
    if (raw) { try { var a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (e) {} }
    return [];
  }
  function pruneRate(recs) {
    var win = Number(RATE.windowMs) || 3600000, now = Date.now();
    return recs.filter(function (r) {
      if (!r || typeof r.t !== 'number') return false;
      var age = now - r.t;
      return age < win && age >= -60000;   // 丢弃过期记录与异常未来时间
    });
  }
  /* 同设备、同 IP 两个维度分别计数，任一达到上限即拦截 */
  function rateStatus() {
    if (RATE.enabled === false) return { limited: false, used: 0, max: 0, wait: 0 };
    var max = Math.max(1, Number(RATE.max) || 3);
    var win = Number(RATE.windowMs) || 3600000;
    var now = Date.now();
    var recs = pruneRate(loadRate());
    var byDev = recs.filter(function (r) { return r.dev === state.deviceId; });
    var byIp = state.ip ? recs.filter(function (r) { return r.ip && r.ip === state.ip; }) : [];
    var used = Math.max(byDev.length, byIp.length);
    var limited = used >= max;
    var wait = 0;
    if (limited) {
      var group = byDev.length >= byIp.length ? byDev : byIp;
      var oldest = Math.min.apply(null, group.map(function (r) { return r.t; }));
      wait = Math.max(0, oldest + win - now);
    }
    return { limited: limited, used: used, max: max, wait: wait };
  }
  function rateRecord() {
    var recs = pruneRate(loadRate());
    recs.push({ t: Date.now(), dev: state.deviceId, ip: state.ip || '' });
    sSet(RATE_KEY, J(recs));
  }
  function updateRateHint() {
    var el = $('#rateHint'), btn = $('#submitBtn');
    if (!el) return;
    if (RATE.enabled === false) {
      el.className = 'rate-hint hidden';
      if (btn) btn.disabled = false;
      return;
    }
    var s = rateStatus();
    if (s.limited) {
      var mins = Math.max(1, Math.ceil(s.wait / 60000));
      el.className = 'rate-hint limited';
      el.textContent = '提交过于频繁，约 ' + mins + ' 分钟后可继续提交';
      if (btn) btn.disabled = true;
    } else {
      el.className = 'rate-hint';
      el.textContent = '1 小时内还可提交 ' + (s.max - s.used) + ' 条';
      if (btn) btn.disabled = false;
    }
  }
  /* 尽力获取公网 IP；离线或跨域失败时静默退化为「仅设备维度」 */
  function fetchIp() {
    var cached = sGet(IP_KEY);
    if (cached) {
      try {
        var o = JSON.parse(cached);
        if (o && o.ip && Date.now() - o.t < 86400000) {
          state.ip = String(o.ip);
          updateRateHint();   // 缓存命中也要按 IP 维度重算额度
          return;
        }
      } catch (e) {}
    }
    var api = RATE.ipApi;
    if (!api || typeof fetch !== 'function') return;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 3000) : null;
    fetch(api, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var ip = j && (j.ip || j.query || j.ip_addr);
        if (ip) {
          state.ip = String(ip);
          sSet(IP_KEY, J({ ip: state.ip, t: Date.now() }));
          updateRateHint();
        }
      })
      .catch(function () {})
      .then(function () { if (timer) clearTimeout(timer); });
  }

  /* ---------- 状态 ---------- */
  function loadData() {
    var raw = sGet(KEY);
    if (raw) {
      try { var a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (e) {}
    }
    return clone(INITIAL);
  }
  function loadMy() {
    var raw = sGet(MY_KEY);
    if (raw) {
      try { var a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (e) {}
    }
    return [];
  }
  var state = {
    data: loadData(),
    myIds: loadMy(),
    rules: loadRules(),
    threshold: loadThreshold(),
    deviceId: getDeviceId(),
    ip: '',
    editIdx: -1,
    view: 'board',
    authed: false,
    cat: 'all',
    kw: '',
    sort: 'desc',
    secretClicks: []
  };
  var secretCooldownUntil = 0;   // 隐藏入口冷却：防止连点多余次数立刻跳回前台
  function save() { sSet(KEY, J(state.data)); sSet(MY_KEY, J(state.myIds)); }

  /* ---------- 广告过滤（规则来自运行时可编辑列表） ---------- */
  function detectAd(text) {
    var score = 0, reasons = [];
    (state.rules || []).forEach(function (r) {
      var p = r.pattern;
      if (!(p instanceof RegExp)) return;
      p.lastIndex = 0;   // 自定义带 g 标志的规则也保证每次从头匹配
      if (p.test(String(text || ''))) { score += Number(r.score) || 0; reasons.push(r.name); }
    });
    return { score: score, reasons: reasons };
  }
  function isBlocked(hit) { return hit.score >= state.threshold; }

  /* ---------- 提示 ---------- */
  var toastTimer;
  function toast(msg, type) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 3000);
  }

  /* ---------- 渲染：数据展示模块（仅后台可见） ---------- */
  function renderStats() {
    var el = $('#stats');
    if (!el) return;
    var approved = state.data.filter(function (x) { return x.status === 'approved'; });
    var pending = state.data.filter(function (x) { return x.status === 'pending'; });
    var replied = approved.filter(function (x) { return x.reply && x.reply.trim(); }).length;
    var today = dayKey(nowISO());
    var todayCount = state.data.filter(function (x) { return dayKey(x.createdAt) === today; }).length;
    var items = [
      { label: '公开发布', value: approved.length, tint: '#eef2ff', tone: '#4f46e5', ico: '公' },
      { label: '待审核', value: pending.length, tint: '#fff3e0', tone: '#b9710a', ico: '审' },
      { label: '官方已回复', value: replied, tint: '#e7f8f4', tone: '#0c8b7c', ico: '复' },
      { label: '今日新增', value: todayCount, tint: '#f3e8ff', tone: '#7c3aed', ico: '新' }
    ];
    el.innerHTML = items.map(function (i) {
      return '<div class="stat" style="--tint:' + i.tint + ';--tone:' + i.tone + '">' +
        '<div><div class="stat-label">' + i.label + '</div><div class="stat-value">' + i.value + '</div></div>' +
        '<div class="stat-ico">' + i.ico + '</div></div>';
    }).join('');
  }

  /* ---------- 渲染：筛选条 ---------- */
  function buildChips() {
    var cats = [{ key: 'all', label: '全部', color: '#6366f1' }].concat(
      (CFG.categories || []).map(function (c) { return { key: c.key, label: c.label, color: c.color }; })
    );
    $('#chips').innerHTML = cats.map(function (c) {
      return '<button class="chip" type="button" data-cat="' + esc(c.key) + '">' +
        '<span class="cdot" style="background:' + c.color + '"></span>' + esc(c.label) + '</button>';
    }).join('');
  }

  /* ---------- 渲染：时间轴（管理员登录后卡片可直接回复） ---------- */
  function cardHtml(x) {
    var c = catOf(x.category);
    var name = x.nickname || '匿名用户';
    var replyHtml = x.reply
      ? '<div class="tl-reply"><b>官方回复</b>：' + esc(x.reply) +
        '<time>' + esc(fmtFull(x.replyAt || x.auditAt || x.createdAt)) + '</time></div>'
      : '';
    var adminHtml = state.authed
      ? '<div class="tl-admin">' +
          '<button class="btn-mini" type="button" data-act="front-reply-toggle" data-id="' + esc(x.id) + '">' +
            (x.reply ? '编辑回复' : '回复此留言') + '</button>' +
          (x.reply
            ? '<button class="btn-mini danger" type="button" data-act="front-reply-clear" data-id="' + esc(x.id) + '">清除回复</button>'
            : '') +
        '</div>' +
        '<div class="reply-editor hidden">' +
          '<textarea maxlength="300" placeholder="以管理员身份回复这条留言…">' + esc(x.reply || '') + '</textarea><br>' +
          '<button class="btn-mini ok" type="button" data-act="front-reply-save" data-id="' + esc(x.id) + '">保存回复</button> ' +
          '<button class="btn-mini" type="button" data-act="front-reply-cancel">取消</button>' +
        '</div>'
      : '';
    return '<article class="tl-item">' +
      '<span class="tl-dot" style="--dot:' + c.color + '"></span>' +
      '<div class="tl-card">' +
        '<div class="tl-head">' +
          '<span class="cat-chip" style="--cc:' + c.color + ';--cbg:' + c.bg + '">' + esc(c.label) + '</span>' +
          '<span class="tl-id">#' + esc(x.id) + '</span>' +
          '<time class="tl-time">' + esc(fmtFull(x.createdAt)) + '</time>' +
        '</div>' +
        '<p class="tl-content">' + esc(x.content || '') + '</p>' +
        '<div class="tl-foot"><span class="avatar">' + esc(name.slice(0, 1)) + '</span>' +
          '<span>' + esc(name) + '</span><span class="sep">·</span><span>来自网页端</span>' +
          (x.contact ? '<span class="sep">·</span><span>已留联系方式</span>' : '') +
        '</div>' + replyHtml + adminHtml +
      '</div></article>';
  }
  function renderTimeline() {
    var cat = state.cat, kw = state.kw.trim().toLowerCase();
    var list = state.data.filter(function (x) { return x.status === 'approved'; });
    if (cat !== 'all') list = list.filter(function (x) { return x.category === cat; });
    if (kw) list = list.filter(function (x) {
      return ((x.content || '') + (x.nickname || '') + catOf(x.category).label).toLowerCase().indexOf(kw) >= 0;
    });
    list.sort(function (a, b) {
      return state.sort === 'desc' ? byTimeDesc(a, b) : -byTimeDesc(a, b);
    });
    var tl = $('#timeline'), empty = $('#emptyState');
    if (!list.length) { tl.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    var groups = [];
    list.forEach(function (x) {
      var k = dayKey(x.createdAt);
      var g = groups.find(function (g) { return g.k === k; });
      if (!g) { g = { k: k, label: dayLabel(x.createdAt), items: [] }; groups.push(g); }
      g.items.push(x);
    });
    tl.innerHTML = groups.map(function (g) {
      return '<div class="tl-date">' + esc(g.label) +
        ' <span style="font-weight:400;color:#a0aabc">· ' + g.items.length + ' 条</span></div>' +
        g.items.map(cardHtml).join('');
    }).join('');
  }

  /* ---------- 渲染：我提交的待审核 ---------- */
  function renderMyPending() {
    var mine = state.data.filter(function (x) {
      return state.myIds.indexOf(x.id) >= 0 && x.status !== 'approved';
    }).sort(byTimeDesc);
    var card = $('#myPendingCard');
    if (!mine.length) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    $('#myPendingList').innerHTML = mine.map(function (x) {
      var rejected = x.status === 'rejected';
      var txt = x.content || '';
      var short = txt.length > 80 ? txt.slice(0, 80) + '…' : txt;
      return '<div class="my-item">' +
        '<div class="st' + (rejected ? ' rejected' : '') + '">' +
          (rejected ? '未通过审核' : '待管理员审核') + '</div>' +
        '<p>' + esc(short) + '</p>' +
        '<span style="color:#a0aabc;font-size:11px">' + esc(fmtFull(x.createdAt)) + ' · ' +
          (rejected ? '管理员未予放行，内容不会公开' : '管理员放行后自动出现在时间轴') +
        '</span></div>';
    }).join('');
  }

  /* ---------- 渲染：审核后台 ---------- */
  function pendingHtml(x) {
    var c = catOf(x.category);
    var reasons = (x.adReasons && x.adReasons.length) ? x.adReasons.join('、') : '无（管理员手动下架）';
    return '<div class="audit-item pending">' +
      '<div class="audit-top">' +
        '<span class="cat-chip" style="--cc:' + c.color + ';--cbg:' + c.bg + '">' + esc(c.label) + '</span>' +
        '<span class="score">广告分 ' + (x.adScore || 0) + '</span>' +
        '<span class="t">#' + esc(x.id) + ' · ' + esc(fmtFull(x.createdAt)) + '</span>' +
      '</div>' +
      '<p>' + esc(x.content || '') + '</p>' +
      '<div class="audit-meta">提交人：' + esc(x.nickname || '匿名用户') +
        (x.contact ? ' · 联系方式：' + esc(x.contact) : '') + '</div>' +
      '<div class="audit-reasons">命中规则：' + esc(reasons) +
        '　｜　拦截阈值：' + state.threshold + ' 分</div>' +
      '<div class="audit-actions">' +
        '<button class="btn-mini ok" type="button" data-act="approve" data-id="' + esc(x.id) + '">通过并放行</button>' +
        '<button class="btn-mini warn" type="button" data-act="reject" data-id="' + esc(x.id) + '">拒绝</button>' +
        '<button class="btn-mini danger" type="button" data-act="delete" data-id="' + esc(x.id) + '">删除</button>' +
      '</div></div>';
  }
  function publishedHtml(x) {
    var c = catOf(x.category);
    var txt = x.content || '';
    var short = txt.length > 110 ? txt.slice(0, 110) + '…' : txt;
    return '<div class="audit-item">' +
      '<div class="audit-top">' +
        '<span class="cat-chip" style="--cc:' + c.color + ';--cbg:' + c.bg + '">' + esc(c.label) + '</span>' +
        '<span class="t">#' + esc(x.id) + ' · ' + esc(fmtFull(x.createdAt)) + '</span>' +
      '</div>' +
      '<p>' + esc(short) + '</p>' +
      '<div class="audit-meta">' + esc(x.nickname || '匿名用户') + ' · ' + (x.reply ? '已回复' : '未回复') + '</div>' +
      (x.reply ? '<div class="reply-note">官方回复：' + esc(x.reply) + '</div>' : '') +
      '<div class="audit-actions">' +
        '<button class="btn-mini" type="button" data-act="reply-toggle">' + (x.reply ? '编辑回复' : '回复') + '</button>' +
        '<button class="btn-mini warn" type="button" data-act="offline" data-id="' + esc(x.id) + '">下架</button>' +
        '<button class="btn-mini danger" type="button" data-act="delete" data-id="' + esc(x.id) + '">删除</button>' +
      '</div>' +
      '<div class="reply-editor hidden">' +
        '<textarea maxlength="300" placeholder="填写官方回复，保存后显示在公开时间轴…">' + esc(x.reply || '') + '</textarea><br>' +
        '<button class="btn-mini ok" type="button" data-act="reply-save" data-id="' + esc(x.id) + '">保存回复</button>' +
      '</div></div>';
  }
  function renderRules() {
    var box = $('#rulesList');
    if (!box) return;
    var ti = $('#thresholdInput');
    if (ti && document.activeElement !== ti) ti.value = state.threshold;
    if (!state.rules.length) {
      box.innerHTML = '<div class="rules-empty">暂无规则，点击「+ 新增规则」添加</div>';
      return;
    }
    box.innerHTML = state.rules.map(function (r, i) {
      var txt = ruleText(r);
      return '<div class="rule-item' + (state.editIdx === i ? ' editing' : '') + '">' +
        '<span class="rs">+' + r.score + ' 分</span>' +
        '<span class="rn">' + esc(r.name) + '</span>' +
        '<code title="' + esc(txt) + '">' + esc(txt) + '</code>' +
        '<div class="rule-actions">' +
          '<button class="btn-mini" type="button" data-act="rule-edit" data-idx="' + i + '">编辑</button>' +
          '<button class="btn-mini danger" type="button" data-act="rule-del" data-idx="' + i + '">删除</button>' +
        '</div></div>';
    }).join('');
  }
  function renderAdmin() {
    var pending = state.data.filter(function (x) { return x.status === 'pending'; }).sort(byTimeDesc);
    var published = state.data.filter(function (x) { return x.status === 'approved'; }).sort(byTimeDesc);
    var rejected = state.data.filter(function (x) { return x.status === 'rejected'; }).length;
    var badge = $('#adminBadge');
    if (badge) {
      badge.textContent = pending.length;
      badge.classList.toggle('hidden', pending.length === 0);
    }
    if (!state.authed) return;
    $('#adminSummary').textContent = '共 ' + state.data.length + ' 条留言 · ' +
      pending.length + ' 条待审核 · ' + published.length + ' 条已发布 · ' + rejected + ' 条已拒绝';
    $('#pendingCount').textContent = pending.length + ' 条';
    $('#publishedCount').textContent = published.length + ' 条';
    $('#pendingList').innerHTML = pending.length
      ? pending.map(pendingHtml).join('')
      : '<div class="list-empty">队列已清空，没有待审核内容</div>';
    $('#publishedList').innerHTML = published.length
      ? published.map(publishedHtml).join('')
      : '<div class="list-empty">暂无已发布留言</div>';
    renderRules();
  }

  /* ---------- 总渲染 ---------- */
  function render() {
    $('#siteTitle').textContent = CFG.siteName || '留言反馈中心';
    $('#siteDesc').textContent = CFG.siteDesc || '';
    document.title = CFG.siteName || '留言反馈中心';
    $('#adminModeBar').classList.toggle('hidden', !state.authed);
    renderStats();
    renderTimeline();
    renderMyPending();
    renderAdmin();
    $('#sortBtn').textContent = state.sort === 'desc' ? '最新在前' : '最早在前';
    document.querySelectorAll('#chips [data-cat]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.cat === state.cat);
    });
  }

  /* ---------- 规则管理 ---------- */
  function clearRuleForm() {
    state.editIdx = -1;
    $('#ruleName').value = '';
    $('#ruleScore').value = '2';
    $('#ruleMode').value = 'keyword';
    $('#rulePattern').value = '';
    $('#ruleTestText').value = '';
    $('#ruleTestResult').textContent = '';
    $('#ruleTestResult').className = 'rule-test-result';
    $('#ruleFormTitle').textContent = '新增规则';
    $('#ruleSaveBtn').textContent = '保存规则';
  }
  function openRuleForm(idx) {
    clearRuleForm();
    if (typeof idx === 'number' && state.rules[idx]) {
      var r = state.rules[idx];
      state.editIdx = idx;
      $('#ruleName').value = r.name;
      $('#ruleScore').value = r.score;
      $('#ruleMode').value = r.mode;
      $('#rulePattern').value = r.raw;
      $('#ruleFormTitle').textContent = '编辑规则';
      $('#ruleSaveBtn').textContent = '保存修改';
    }
    $('#ruleForm').classList.remove('hidden');
    $('#ruleName').focus();
    renderRules();
  }
  function closeRuleForm() {
    clearRuleForm();
    $('#ruleForm').classList.add('hidden');
    renderRules();
  }
  function saveRuleFromForm() {
    var name = $('#ruleName').value.trim();
    var score = Math.max(1, Math.min(10, Math.floor(Number($('#ruleScore').value) || 1)));
    var mode = $('#ruleMode').value === 'regex' ? 'regex' : 'keyword';
    var raw = $('#rulePattern').value.trim();
    if (!name) { toast('请填写规则名称', 'err'); $('#ruleName').focus(); return; }
    if (!raw) { toast('请填写匹配内容', 'err'); $('#rulePattern').focus(); return; }
    if (raw.length > 300) { toast('匹配内容过长，请精简后重试', 'err'); return; }
    var re = makeRegExp(mode, raw, 'i');
    if (!re) { toast('表达式不合法，请检查后重试', 'err'); return; }
    var rule = { name: name.slice(0, 20), score: score, mode: mode, raw: raw, pattern: re };
    var wasEdit = state.editIdx >= 0 && !!state.rules[state.editIdx];
    if (wasEdit) state.rules[state.editIdx] = rule;
    else state.rules.push(rule);
    saveRules();
    closeRuleForm();
    render();
    toast(wasEdit ? '规则已更新' : '规则已添加', 'ok');
  }
  function testRuleFromForm() {
    var mode = $('#ruleMode').value === 'regex' ? 'regex' : 'keyword';
    var raw = $('#rulePattern').value.trim();
    var text = $('#ruleTestText').value;
    var tip = $('#ruleTestResult');
    var re = raw ? makeRegExp(mode, raw, 'i') : null;
    if (!re) { tip.textContent = '表达式不合法'; tip.className = 'rule-test-result bad'; return; }
    if (!text.trim()) { tip.textContent = '请输入测试文字'; tip.className = 'rule-test-result miss'; return; }
    re.lastIndex = 0;
    var hit = re.test(text);
    tip.textContent = hit ? '✓ 命中' : '未命中';
    tip.className = 'rule-test-result ' + (hit ? 'hit' : 'miss');
  }
  function deleteRule(idx) {
    if (!state.rules[idx]) return;
    if (!confirm('确定删除规则「' + state.rules[idx].name + '」？')) return;
    state.rules.splice(idx, 1);
    state.editIdx = -1;
    saveRules();
    closeRuleForm();
    render();
    toast('规则已删除', 'ok');
  }
  function resetRules() {
    if (!confirm('确定恢复默认规则？自定义规则与阈值设置将被覆盖。')) return;
    state.rules = defaultRules();
    state.threshold = Math.max(1, Number(CFG.adScoreThreshold) || 2);
    sDel(RULES_KEY); sDel(THRESHOLD_KEY);
    closeRuleForm();
    render();
    toast('已恢复默认规则', 'ok');
  }
  function saveThreshold() {
    var n = Math.floor(Number($('#thresholdInput').value));
    if (!(n >= 1 && n <= 99)) { toast('阈值需为 1-99 的整数', 'err'); return; }
    state.threshold = n;
    sSet(THRESHOLD_KEY, String(n));
    render();
    toast('拦截阈值已保存', 'ok');
  }

  /* ---------- 审核操作 ---------- */
  function audit(id, act) {
    var i = state.data.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    var x = state.data[i], now = nowISO();
    if (act === 'approve') {
      x.status = 'approved'; x.auditAt = now; x.auditor = '管理员';
      toast('已放行，留言现已显示在公开时间轴', 'ok');
    } else if (act === 'reject') {
      x.status = 'rejected'; x.auditAt = now; x.auditor = '管理员';
      toast('已拒绝，该留言不会公开展示', 'warn');
    } else if (act === 'offline') {
      x.status = 'pending'; x.auditAt = now; x.auditor = '管理员';
      x.adScore = Math.max(x.adScore || 0, state.threshold);
      if (!x.adReasons || !x.adReasons.length) x.adReasons = ['管理员手动下架'];
      toast('已下架，转入待审核队列', 'warn');
    } else if (act === 'delete') {
      state.data.splice(i, 1);
      state.myIds = state.myIds.filter(function (m) { return m !== id; });
      toast('留言已删除', 'ok');
    }
    save();
    render();
  }

  /* ---------- 导出 data.js（把变更写回 JS 数据文件） ---------- */
  function buildDataJS() {
    var c = CFG;
    var rl = c.rateLimit || RATE;
    /* 只导出哈希；若来源是旧版明文配置，就地迁移为哈希 */
    var auth = authConfig();
    var outHash = auth.legacy ? hashPassword(auth.legacy, DEFAULT_SALT, DEFAULT_ITER) : auth.hash;
    var outSalt = auth.legacy ? DEFAULT_SALT : (auth.salt || DEFAULT_SALT);
    var outIter = auth.iterations || DEFAULT_ITER;
    var cats = (c.categories || []).map(function (x) {
      return '    { key: ' + J(x.key) + ', label: ' + J(x.label) +
        ', color: ' + J(x.color) + ', bg: ' + J(x.bg) + ' }';
    }).join(',\n');
    var rules = state.rules.map(function (r) {
      return '    { name: ' + J(r.name) + ', score: ' + r.score +
        ', pattern: ' + (r.pattern ? String(r.pattern) : 'null') +
        ', mode: ' + J(r.mode) + ', raw: ' + J(r.raw) + ' }';
    }).join(',\n');
    return '/* data.js —— 由「审核后台 · 导出」自动生成，覆盖原文件即可保存变更 */\n\n' +
      'window.FEEDBACK_CONFIG = {\n' +
      '  siteName: ' + J(c.siteName) + ',\n' +
      '  siteDesc: ' + J(c.siteDesc) + ',\n' +
      '  adminPasswordHash: ' + J(outHash) + ',\n' +
      '  adminSalt: ' + J(outSalt) + ',\n' +
      '  hashIterations: ' + outIter + ',\n' +
      '  secretClicks: ' + (c.secretClicks || 5) + ',\n' +
      '  secretWindowMs: ' + (c.secretWindowMs || 2000) + ',\n' +
      '  adScoreThreshold: ' + state.threshold + ',\n' +
      '  maxLength: ' + (Number(c.maxLength) || 500) + ',\n' +
      '  rateLimit: { enabled: ' + (rl.enabled !== false) +
        ', windowMs: ' + (Number(rl.windowMs) || 3600000) +
        ', max: ' + (Number(rl.max) || 3) +
        ', ipApi: ' + J(rl.ipApi || '') + ' },\n' +
      '  categories: [\n' + cats + '\n  ],\n' +
      '  adRules: [\n' + rules + '\n  ]\n' +
      '};\n\n' +
      'window.FEEDBACK_DATA = ' + JSON.stringify(state.data, null, 2) + ';\n';
  }
  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- 交互 ---------- */
  function updateAdWarning() {
    var text = [$('#nickname').value, $('#content').value, $('#contact').value].join(' ');
    var hit = detectAd(text);
    var box = $('#adWarning');
    if (text.trim() && isBlocked(hit)) {
      box.classList.remove('hidden');
      box.innerHTML = '注意：检测到疑似广告内容（广告分 <b>' + hit.score + '</b>，命中：' +
        esc(hit.reasons.join('、')) + '）。提交后不会直接公开，将进入后台审核队列，' +
        '<b>需管理员放行后才会展示</b>。';
    } else {
      box.classList.add('hidden');
    }
  }
  function switchView(v) {
    state.view = v;
    state.secretClicks = [];
    if (v === 'board') secretCooldownUntil = 0;
    $('#viewBoard').classList.toggle('hidden', v !== 'board');
    $('#viewAdmin').classList.toggle('hidden', v !== 'admin');
    $('#viewHint').classList.toggle('hidden', v !== 'admin');
    $('#boardTab').classList.add('active');
    render();
    window.scrollTo(0, 0);   // 瞬间置顶，避免平滑滚动形成可见反馈
  }
  /* 隐藏入口：有效时间窗内连续点击「留言广场」N 次，静默进入后台 */
  function handleBoardClick() {
    var now = Date.now();
    if (now < secretCooldownUntil) return;   // 防止连点多余次数立刻跳回前台
    if (state.view === 'admin') { switchView('board'); return; }
    var need = Number(CFG.secretClicks) || 5;
    var win = Number(CFG.secretWindowMs) || 2000;
    state.secretClicks = state.secretClicks.filter(function (t) { return now - t < win; });
    state.secretClicks.push(now);
    if (state.secretClicks.length >= need) {
      state.secretClicks = [];
      secretCooldownUntil = Date.now() + 800;
      switchView('admin');   // 无 toast、无提示，静默切换
    }
  }
  function doLogin() {
    if (checkPassword($('#adminPass').value)) {
      state.authed = true;
      $('#loginPanel').classList.add('hidden');
      $('#adminPanel').classList.remove('hidden');
      render();
      toast('已进入审核后台，返回前台即可直接回复留言', 'ok');
    } else {
      toast('口令不正确，请重试', 'err');
    }
  }
  function doLogout() {
    state.authed = false;
    $('#adminPass').value = '';
    $('#adminPanel').classList.add('hidden');
    $('#loginPanel').classList.remove('hidden');
    render();
    toast('已退出管理', 'ok');
  }
  /* 修改管理口令：生成新随机盐 + 哈希，本地即时生效，导出后永久保存 */
  function changePassword() {
    var old = $('#oldPass').value, n1 = $('#newPass').value, n2 = $('#newPass2').value;
    if (!checkPassword(old)) { toast('当前口令不正确', 'err'); return; }
    if (n1.length < 6) { toast('新口令至少 6 位', 'err'); return; }
    if (n1 !== n2) { toast('两次输入的新口令不一致', 'err'); return; }
    var salt = randomSalt();
    var it = Number(authConfig().iterations) || DEFAULT_ITER;
    sSet(AUTH_KEY, J({ hash: hashPassword(n1, salt, it), salt: salt, iterations: it }));
    $('#oldPass').value = ''; $('#newPass').value = ''; $('#newPass2').value = '';
    $('#pwdForm').classList.add('hidden');
    toast('管理口令已更新，导出数据可永久保存', 'ok');
  }

  function init() {
    /* 分类下拉 */
    $('#category').innerHTML = (CFG.categories || []).map(function (c) {
      return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>';
    }).join('');
    var maxLen = Number(CFG.maxLength) || 500;
    $('#content').setAttribute('maxlength', maxLen);
    $('.counter').innerHTML = '<span id="charCount">0</span> / ' + maxLen;
    buildChips();

    /* 顶部 Tab：审核后台按钮隐藏，靠连点「留言广场」静默进入 */
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        if (t.dataset.view === 'board') handleBoardClick();
        else switchView('admin');
        t.blur();   // 点击后立即失焦，避免残留焦点框/高亮
      });
    });

    /* 分类筛选 */
    $('#chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      state.cat = b.dataset.cat;
      render();
    });
    $('#search').addEventListener('input', function () {
      state.kw = this.value;
      renderTimeline();
    });
    $('#sortBtn').addEventListener('click', function () {
      state.sort = state.sort === 'desc' ? 'asc' : 'desc';
      render();
    });

    /* 表单：实时广告检测 + 字数 */
    ['#nickname', '#content', '#contact'].forEach(function (sel) {
      $(sel).addEventListener('input', function () {
        $('#charCount').textContent = $('#content').value.length;
        updateAdWarning();
      });
    });
    $('#feedbackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var rs = rateStatus();
      if (rs.limited) { toast('提交过于频繁，请稍后再试', 'err'); updateRateHint(); return; }
      var nickname = $('#nickname').value.trim() || '匿名用户';
      var category = $('#category').value;
      var content = $('#content').value.trim();
      var contact = $('#contact').value.trim();
      if (content.length < 5) { toast('反馈内容至少需要 5 个字', 'err'); $('#content').focus(); return; }
      if (content.length > maxLen) { toast('内容超出字数限制', 'err'); return; }
      var hit = detectAd([nickname, content, contact].join(' '));
      var blocked = isBlocked(hit);
      var id = genId();
      state.data.push({
        id: id, nickname: nickname, category: category, content: content, contact: contact,
        createdAt: nowISO(), status: blocked ? 'pending' : 'approved',
        adScore: hit.score, adReasons: hit.reasons,
        auditAt: blocked ? '' : nowISO(), auditor: blocked ? '' : '系统自动放行',
        reply: '', replyAt: ''
      });
      if (blocked) state.myIds.push(id);
      rateRecord();   // 成功提交即计入额度（含被拦截的，避免绕过）
      save();
      this.reset();
      $('#charCount').textContent = '0';
      updateAdWarning();
      updateRateHint();
      render();
      if (blocked) toast('已提交：内容疑似广告，需管理员在后台放行后才会展示', 'warn');
      else toast('发布成功，已出现在时间轴', 'ok');
    });

    /* 后台登录 / 退出 / 返回前台 / 导出 / 重置 */
    $('#loginBtn').addEventListener('click', doLogin);
    $('#adminPass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLogin();
    });
    $('#logoutBtn').addEventListener('click', doLogout);
    $('#exitAdminMode').addEventListener('click', function () {
      doLogout();
      switchView('board');
    });
    $('#backBoardBtn').addEventListener('click', function () { switchView('board'); });
    $('#loginBackBtn').addEventListener('click', function () { switchView('board'); });
    $('#exportBtn').addEventListener('click', function () {
      download('data.js', buildDataJS());
      toast('数据已导出', 'ok');
    });
    $('#resetBtn').addEventListener('click', function () {
      if (!confirm('确定恢复初始留言数据？当前新增与审核变更将被清除。')) return;
      sDel(KEY); sDel(MY_KEY);
      state.data = clone(INITIAL);
      state.myIds = [];
      render();
      toast('已恢复初始数据', 'ok');
    });

    /* 规则管理 */
    $('#ruleAddBtn').addEventListener('click', function () { openRuleForm(-1); });
    $('#ruleCancelBtn').addEventListener('click', closeRuleForm);
    $('#ruleSaveBtn').addEventListener('click', saveRuleFromForm);
    $('#ruleTestBtn').addEventListener('click', testRuleFromForm);
    $('#thresholdSaveBtn').addEventListener('click', saveThreshold);
    $('#thresholdInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveThreshold();
    });
    $('#ruleResetBtn').addEventListener('click', resetRules);

    /* 安全设置：修改管理口令 */
    $('#pwdToggleBtn').addEventListener('click', function () {
      $('#pwdForm').classList.toggle('hidden');
    });
    $('#pwdCancelBtn').addEventListener('click', function () {
      $('#oldPass').value = ''; $('#newPass').value = ''; $('#newPass2').value = '';
      $('#pwdForm').classList.add('hidden');
    });
    $('#pwdSaveBtn').addEventListener('click', changePassword);

    /* 事件委托：规则操作 + 后台审核 + 前台管理员直接回复 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act, id = b.dataset.id;

      if (act === 'rule-edit' || act === 'rule-del') {
        var idx = Number(b.dataset.idx);
        if (!isFinite(idx) || !state.rules[idx]) return;
        if (act === 'rule-edit') openRuleForm(idx);
        else deleteRule(idx);
        return;
      }

      if (act.indexOf('front-reply-') === 0) {
        var card = b.closest('.tl-card');
        if (!card) return;
        var editor = card.querySelector('.reply-editor');
        var item = state.data.find(function (x) { return x.id === id; });
        /* 取消按钮没有 data-id，因此不能依赖 item 存在才响应 */
        if (act === 'front-reply-toggle') {
          var willOpen = editor.classList.contains('hidden');
          editor.classList.toggle('hidden');
          if (willOpen && item) editor.querySelector('textarea').value = item.reply || '';
        } else if (act === 'front-reply-cancel') {
          editor.classList.add('hidden');
          if (item) editor.querySelector('textarea').value = item.reply || '';
        } else if (act === 'front-reply-save' && item) {
          var v = editor.querySelector('textarea').value.trim();
          item.reply = v;
          item.replyAt = v ? nowISO() : '';
          save(); render();
          toast(v ? '回复已发布到时间轴' : '已清空回复', 'ok');
        } else if (act === 'front-reply-clear' && item) {
          item.reply = ''; item.replyAt = '';
          save(); render();
          toast('已清除官方回复');
        }
        return;
      }

      if (act === 'approve' || act === 'reject' || act === 'offline' || act === 'delete') {
        if (act === 'delete' && !confirm('确定删除这条留言？此操作不可撤销。')) return;
        audit(id, act);
      } else if (act === 'reply-toggle') {
        var box = b.closest('.audit-item').querySelector('.reply-editor');
        box.classList.toggle('hidden');
      } else if (act === 'reply-save') {
        var auditEditor = b.closest('.audit-item').querySelector('.reply-editor');
        var replyText = auditEditor.querySelector('textarea').value.trim();
        var target = state.data.find(function (x) { return x.id === id; });
        if (target) {
          target.reply = replyText;
          target.replyAt = replyText ? nowISO() : '';
          save(); render();
          toast(replyText ? '回复已保存，已显示在时间轴' : '已清空回复', 'ok');
        }
      }
    });

    fetchIp();                           // 先同步读取 IP 缓存，再计算额度
    updateRateHint();
    setInterval(updateRateHint, 30000);   // 到期后自动恢复提交按钮
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
