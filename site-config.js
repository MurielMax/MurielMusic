/* ============================================================================
 * Muriel Music 落地页 · 接口配置文件
 * ----------------------------------------------------------------------------
 * 升级时【只需要修改本文件】，index.html 会自动读取并渲染，无需动页面代码。
 *
 * 使用方式：
 *   1) 把本文件与 index.html 放在同一目录（仓库根目录或 GitHub Pages 根）。
 *   2) 改下面的值，刷新页面 / 重新部署 Pages 即生效。
 *   3) index.html 内用 {{字段名}} 占位（例如 {{version}}），会被本文件对应值替换。
 *
 * 注意：
 *   - 下载链接 apkUrl / srcUrl 默认是「同目录相对文件名」，适合 GitHub Pages / 本地。
 *     若你把安装包托管在别处，直接改成完整 https 地址即可。
 *   - 字段缺失时页面会原样显示 {{字段名}} 作为降级，不会崩。
 * ========================================================================== */

window.MM_CONFIG = {

  /* —— 版本与构建（每次发版改这里） —— */
  version: "2.5.12",            // 版本号：页面所有 vX.Y.Z 处（v2.3.14 已回退未发布，跳过）
  build:   196,                // versionCode：标签与页脚的「build N」（v2.5.0 下载链路修复 + 弹窗配色 + 网易云/酷我歌单直连）
  pkg:     "com.muriel.music", // 应用包名：页脚展示

  /* —— 产物信息（展示用，升级时同步改） —— */
  apkSize:   1.50,            // APK 大小（MB），仅文案展示（v2.5.0 正式版 ≈ 1.37 MB）
  javaFiles: 69,              // 主源码 Java 文件数：统计卡片（v2.4.9 新增 LocalCats）
  tests:     "164/164",       // 离线 JVM 单测：local_cats 45 + asr 21 + nav 44 + scan 28 + umeng 26
                               //   （实际已随版本增长，按你当前想对外展示的数填写）

  /* —— 下载链接（升级时改成新文件名 / 新地址） —— */
  apkUrl: "https://v6.gh-proxy.org/https://github.com/MurielMax/MurielMusic/releases/download/Muriel%E9%9F%B3%E4%B9%90v2.5.12/Muriel._2.5.12.apk", // APK 下载地址
  srcUrl: "",     // 源码包下载地址

  /* —— Android 4.2 兼容版（mini）：与主线功能一致，minSdk 17，走过时设备 —— */
  miniVersion: "2.5.12-mini",                          // 兼容版版本号（与主线 2.5.12 同步）
  miniBuild:   196,                                    // 兼容版 versionCode（与主线对齐，覆盖安装）
  miniApkSize: 1.50,                                   // 兼容版 APK 大小（MB），仅文案展示
  miniApkUrl:  "https://v4.gh-proxy.org/https://github.com/MurielMax/MurielMusic/releases/download/Muriel%E9%9F%B3%E4%B9%90v2.5.12/Muriel._2.5.12-mini.apk", // 兼容版 APK 下载地址
  miniSrcUrl:  "",     // 兼容版源码包地址

  /* —— 文档与仓库链接（一般不改，留作扩展） —— */
  readmeZh: "README.md",
  readmeEn: "README.en.md",
  repoUrl:  "https://github.com/murielmax/MurielMusic",
  pagesUrl: "https://murielmax.github.io/MurielMusic/"

};
