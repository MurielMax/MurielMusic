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
 *   - links 缺失 / 为空 / 全部 show=false 时，「拓展」分类整个不显示
 *   - open: "inner" = App 内 WebView 打开；"outer" = 系统浏览器打开
 *
 * 发新版时：把 version / build / notes / apkUrl 改成新值，
 * build 调大即触发旧版本用户弹窗；apkUrl 必须是可直连下载的 https 地址。
 * 当前值与 v2.4.1 安装包一致（build 144），因此本配置不会让 2.4.1 用户弹窗。
 * ========================================================================== */


window.MM_UPDATE = {
  version: "2.4.5(build 146)",
  build: 146,
  notes: "1. 新增启动时检查更新\n2. 我的页新增拓展分类",
  apkUrl: "https://v4.gh-proxy.org/https://github.com/MurielMax/MurielMusic/releases/download/Muriel%E9%9F%B3%E4%B9%90v2.4.0/Muriel.v2.4.0.apk",
  force: false,
  links: [
    { name: "官方网站",   url: "https://murielmax.github.io/MurielMusic/",   show: true,  open: "inner" },
    { name: "问题反馈",   url: "https://murielmax.github.io/MurielMusic/book/", show: true,  open: "inner" }
  ]
};
