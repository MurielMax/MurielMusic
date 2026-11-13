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
  version: "2.4.8",            // 版本号：页面所有 vX.Y.Z 处
  build:   154,                // versionCode：标签与页脚的「build N」
  pkg:     "com.muriel.music", // 应用包名：页脚展示

  /* —— 产物信息（展示用，升级时同步改） —— */
  apkSize:   1.49,              // APK 大小（KB），仅文案展示
  javaFiles: 53,               // 主源码 Java 文件数：统计卡片
  tests:     "31/31",         // 离线单测通过情况：统计卡片 / 兼容性表
                               //   （实际已随版本增长，按你当前想对外展示的数填写）

  /* —— 下载链接（升级时改成新文件名 / 新地址） —— */
  apkUrl: "https://v4.gh-proxy.org/https://github.com/MurielMax/MurielMusic/releases/download/Muriel%E9%9F%B3%E4%B9%90v2.4.8/Muriel.v2.4.8.apk", // APK 下载地址
  srcUrl: "",   // 源码包下载地址

  /* —— 文档与仓库链接（一般不改，留作扩展） —— */
  readmeZh: "https://github.com/MurielMax/MurielMusic/blob/main/README.md",
  readmeEn: "https://github.com/MurielMax/MurielMusic/blob/main/README.en.md",
  repoUrl:  "https://github.com/murielmax/MurielMusic",
  pagesUrl: "https://murielmax.github.io/MurielMusic/"

};
