/* ==========================================================================
 * data.js  |  留言反馈中心 —— 数据存储文件（相当于"数据库"）
 * --------------------------------------------------------------------------
 * 站点配置、反馈分类、广告过滤规则、全部留言，都以纯 JS 对象保存在本文件，
 * 页面通过 <script src="data.js"></script> 直接读取，无需后端、无需数据库。
 *
 * 运行机制（"用 JS 文件做储存"的完整闭环）：
 *   1. 首次打开页面 -> 从本文件读取 window.FEEDBACK_DATA 作为初始数据；
 *   2. 新增留言 / 后台审核产生的变更 -> 实时写入浏览器 localStorage；
 *   3. 在「审核后台」点击「导出 data.js」-> 下载最新数据文件并覆盖本文件，
 *      即可把变更永久写回 JS 文件，换设备、重启浏览器都不会丢。
 * ========================================================================== */

window.FEEDBACK_CONFIG = {
  siteName: '产品反馈中心',
  siteDesc: '每一条反馈都会被认真对待，时间轴记录产品成长的每一步',
  adminPassword: '851985',       // 审核后台口令，可自行修改
  secretClicks: 5,                 // 连续点击「留言广场」几次进入隐藏的审核后台
  secretWindowMs: 2000,            // 连点有效时间窗（毫秒），超时重新计数
  adScoreThreshold: 2,             // 广告分 >= 该值自动拦截，转入后台审核队列
  maxLength: 500,
  rateLimit: {                     // 提交频率限制（可在后台关闭或调整）
    enabled: true,
    windowMs: 3600000,            // 统计时间窗：1 小时
    max: 3,                       // 同设备 / 同 IP 在窗口内最多提交 3 条
    ipApi: 'https://api.ipify.org?format=json'   // 留空字符串则只按设备限制
  },
  categories: [
    { key: 'feature', label: '功能建议', color: '#6366f1', bg: '#eef2ff' },
    { key: 'new',     label: '新增需求', color: '#0284c7', bg: '#e0f2fe' },
    { key: 'bug',     label: 'BUG 反馈', color: '#dc2626', bg: '#fee2e2' },
    { key: 'ux',      label: '体验优化', color: '#d97706', bg: '#fef3c7' },
    { key: 'other',   label: '其他',     color: '#475569', bg: '#f1f5f9' }
  ],

  /* 广告过滤规则：可在「审核后台」新增、编辑、删除，阈值也可在后台调整。
     命中即累加分值，累计分 >= adScoreThreshold 会被拦截。
     分值设计上：单纯贴一个报错链接（1 分）不会误伤正常 BUG 反馈，
     而营销词 / 站外联系方式 / 手机号 任一命中（2 分）即需人工审核。 */
  adRules: [
    { name: '营销推广词', score: 2, pattern: /(广告|推广|代购|加盟|代理|招商|批发|一手货源|厂家直销|返利|优惠券|免费领|免费送|秒杀|限时抢|折扣|下单|私聊|联系我|加我|赚钱|兼职|刷单|引流|涨粉|贷款|博彩|彩票|开户|加群|进群|低价|点击领取|扫码领)/i },
    { name: '站外联系方式', score: 2, pattern: /(微信|vx|v信|威信|薇信|加v|\+v|weixin|wechat|qq|扣扣|公众号|二维码|扫码|telegram|whatsapp)/i },
    { name: '手机号/QQ号', score: 2, pattern: /(1[3-9]\d{9})|(?:qq|扣扣|q)\s*[:：]?\s*\d{5,12}/i },
    { name: '网址/外链', score: 1, pattern: /(https?:\/\/|www\.|[\w-]+\.(?:com|cn|net|top|xyz|vip|shop|club|site|link|icu)(?:\/|\b))/i },
    { name: '诱导性话术', score: 2, pattern: /(点此|猛戳|速来|马上去|仅限今日|内部渠道|稳赚|日入|月入|包赚|点击链接|详情私|错过再等)/i },
    { name: '重复刷屏字符', score: 1, pattern: /(.)\1{5,}/ },
    { name: '异常数字串', score: 1, pattern: /\d{7,}/ }
  ]
};

/* 字段说明：
 * id 编号 | nickname 昵称 | category 分类 key | content 正文 | contact 联系方式
 * createdAt 提交时间 | status 状态：approved 已发布 / pending 待审核 / rejected 已拒绝
 * adScore 广告分 | adReasons 命中规则 | auditAt 审核时间 | auditor 审核人
 * reply 官方回复 | replyAt 回复时间
 */
window.FEEDBACK_DATA = [
  {
    id: 'FB20261111001',
    nickname: '林小满',
    category: 'feature',
    content: '希望时间轴支持按分类折叠，反馈多起来之后一屏看不完，按类型收起会清爽很多。另外建议给已处理的反馈加个「已上线」标记。',
    contact: '',
    createdAt: '2026-11-11T09:42:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-11T09:45:00',
    auditor: '管理员',
    reply: '已记录，「分类折叠」排进 v2.3 需求池，「已上线」标记本周会先做一版。',
    replyAt: '2026-11-11T10:16:00'
  },
  {
    id: 'FB20261110005',
    nickname: '阿哲',
    category: 'bug',
    content: 'Safari 下提交反馈后按钮一直转圈，但数据其实已经写进去了，刷新会看到两条重复记录。控制台报了一个 Promise 未捕获的错误。',
    contact: '',
    createdAt: '2026-11-10T18:20:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-10T18:33:00',
    auditor: '管理员',
    reply: '已复现，是重复提交锁没生效，修复会随 v2.2.1 发布，感谢详细的环境信息。',
    replyAt: '2026-11-10T19:02:00'
  },
  {
    id: 'FB20261110004',
    nickname: 'Mia',
    category: 'new',
    content: '能不能新增一个「反馈被采纳」的邮件通知？留了邮箱之后想知道进度，现在只能自己回来看时间轴。',
    contact: 'mia@example.com',
    createdAt: '2026-11-10T14:05:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-10T14:20:00',
    auditor: '管理员',
    reply: '',
    replyAt: ''
  },
  {
    id: 'FB20261109003',
    nickname: '老周',
    category: 'ux',
    content: '移动端分类筛选那排按钮要横向滑动才能看全，建议改成两行自适应，或者加一个「全部」快捷按钮。',
    contact: '',
    createdAt: '2026-11-09T21:33:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-09T21:40:00',
    auditor: '管理员',
    reply: '采纳，下个版本改成自动换行布局。',
    replyAt: '2026-11-10T09:12:00'
  },
  {
    id: 'FB20261109002',
    nickname: '匿名',
    category: 'feature',
    content: '建议给每条反馈加一个点赞数，这样大家能一起把最想要的功能顶上去，也方便我们排优先级。',
    contact: '',
    createdAt: '2026-11-09T10:12:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-09T10:30:00',
    auditor: '管理员',
    reply: '',
    replyAt: ''
  },
  {
    id: 'FB20261108002',
    nickname: '测试同学',
    category: 'bug',
    content: '分类选择「BUG 反馈」时，输入内容包含尖括号会显示成空白，看起来是没做转义，存在 XSS 风险，辛苦修一下。',
    contact: '',
    createdAt: '2026-11-08T16:48:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-08T17:02:00',
    auditor: '管理员',
    reply: '已修复，全部输出改为 HTML 转义，感谢提醒。',
    replyAt: '2026-11-08T18:20:00'
  },
  {
    id: 'FB20261107001',
    nickname: '小北',
    category: 'other',
    content: '整体挺好用的，就是想问下反馈数据会不会定期清理？希望历史记录能一直留着，翻起来挺有成就感的。',
    contact: '',
    createdAt: '2026-11-07T11:20:00',
    status: 'approved',
    adScore: 0,
    adReasons: [],
    auditAt: '2026-11-07T11:35:00',
    auditor: '管理员',
    reply: '不会清理，数据文件可自行导出备份，历史会一直保留。',
    replyAt: '2026-11-07T14:00:00'
  },

  /* 以下为被广告过滤拦截的留言：不会出现在公开时间轴，等待后台放行 */
  {
    id: 'FB20261111002',
    nickname: '优惠助手',
    category: 'other',
    content: '【限时福利】全场低价代购，加微信领优惠券，扫码进群还有返利，日入几百稳赚，点此查看详情！',
    contact: '',
    createdAt: '2026-11-11T13:08:00',
    status: 'pending',
    adScore: 8,
    adReasons: ['营销推广词', '站外联系方式', '诱导性话术'],
    auditAt: '',
    auditor: '',
    reply: '',
    replyAt: ''
  },
  {
    id: 'FB20261110006',
    nickname: '推广小哥',
    category: 'new',
    content: '推荐个好东西，www.abc-top.xyz 免费领会员，联系我 13800001111，代理加盟也行，速来！',
    contact: '',
    createdAt: '2026-11-10T20:47:00',
    status: 'pending',
    adScore: 7,
    adReasons: ['营销推广词', '站外联系方式', '手机号/QQ号', '网址/外链', '诱导性话术'],
    auditAt: '',
    auditor: '',
    reply: '',
    replyAt: ''
  }
];
