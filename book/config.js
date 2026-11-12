/* ============================================================================
 * Muriel音乐 · 远程配置（App 启动时读取）
 * ----------------------------------------------------------------------------
 * 部署位置：把本文件上传到 https://murielmax.github.io/MurielMusic/book/config.js
 * App 端地址（写死在 RemoteConfig.URL），改这里的文件即可，无需改 App。
 *
 * 本文件同时驱动两处：
 *   ① 启动时检查更新（version / build / notes / apkUrl / force）
 *   ② 「我的」页的「拓展」分类（links）
 *
 * 约定（App 不执行 JS，只把赋值壳剥掉按标准 JSON 解析）：
 *   - 只能放数据，不能写函数 / 表达式；键与字符串一律用英文双引号
 *   - 允许行注释与块注释（解析器会在字符串外剥掉）
 *   - build 用整数比较，必须 > 当前 APK 的 versionCode 才会弹更新
 *   - 弹窗里只显示 version，不显示 build
 *   - force=true 时弹窗没有取消按钮，返回键只退出软件，下载完自动安装
 *   - showCheckUpdate=true 时「我的 → 关于」才出现「检查更新」选项；缺省 / false 时不显示
 *   - links 缺失 / 为空 / 全部 show=false 时，「拓展」分类整个不显示
 *   - open: "inner" = App 内 WebView 打开；"outer" = 系统浏览器打开
 *
 * 发新版时：把 version / build / notes / apkUrl 改成新值，
 * build 调大即触发旧版本用户弹窗；apkUrl 必须是可直连下载的 https 地址。
 * 当前值与 v2.4.1 安装包一致（build 144），因此本配置不会让 2.4.1 用户弹窗。
 * ========================================================================== */


window.MM_UPDATE = {
  "version": "2.4.5(build 151)",
  "build": 152,
  "notes": "★横竖屏切换不再丢失唱片状态；调整横屏唱盘大小；\n★新增：启动时检查更新；\n★新增：「我的」页面问题反馈入口；\n★新增：全局沉浸式状态栏，内容延伸到状态栏下、图标随皮肤变色；☆本次优化：连点版本 9 次的间隔放宽到 5 秒；\n★本次新增：珍珠皮肤播放器背景开关：开启后「海报淡主色 → 唱片下方淡白」竖向渐变，切歌自动换色；关闭即纯奶油白；☆优化：修复优化若干问题；\n直接覆盖安装即可（Android 4.4+，无需卸载）。",
  "apkUrl": "https://v4.gh-proxy.org/https://github.com/MurielMax/MurielMusic/releases/download/Muriel%E9%9F%B3%E4%B9%90v2.4.5/Muriel.v2.4.5.apk",
  "force": false,
  "showCheckUpdate": true
  ,
  "links": [
    { name: "官方网站",   url: "https://murielmax.github.io/MurielMusic/",   show: true,  open: "outer" },
    { name: "问题反馈",   url: "https://murielmax.github.io/MurielMusic/book/", show: true,  open: "inner" }
  ]
};
