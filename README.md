<div align="center">

# Muriel 音乐 · Muriel Music

**一款零依赖、无后端、支持 Android 4.4 的多音源音乐播放器**

[English](README.en.md) · **简体中文** · [在线介绍页](https://murielmax.github.io/MurielMusic/)

![version](https://img.shields.io/badge/version-2.3.5-informational)
![Android](https://img.shields.io/badge/Android-4.4%2B-3DDC84)
![dependencies](https://img.shields.io/badge/dependencies-0-orange)
![backend](https://img.shields.io/badge/backend-none-blue)
![Java](https://img.shields.io/badge/Java-8-red)

</div>

> 搜索、直链解析、歌词、封面、节奏分析**全部在 App 内完成**，不需要任何服务器。
> 纯 Android 系统 API，**零第三方依赖**，装上就能用。

Muriel 音乐从 Android 4.4（API 19）一路兼容到最新系统，把「多平台聚合搜索 + 本地播放 + 桌面小部件 + 频谱律动」塞进一个不到 600 KB 的安装包里。它是为学习 Android 原生开发而写的个人作品，也是一台不用联网账号、不用注册、不上传任何数据的本地播放器。

---

## ✨ 为什么值得一看

| 亮点 | 说明 |
|---|---|
| **零第三方依赖** | 没有 OkHttp、Glide、ExoPlayer、Jetpack、Kotlin。HTTP、图片缓存、JSON、FFT、LRC 解析全部自己实现，依赖块是空的 |
| **无需后端** | 四个音源的搜索 / 直链 / 歌词接口直接内置进 App，不存在服务端、API Key 或自建转发 |
| **真正的 4.4 兼容** | `minSdk 19`，TLS 1.2、媒体键重签、`TYPE_PHONE` 悬浮窗、全 PNG 图标、本地 HTTPS 代理等老平台专用分支一处未删 |
| **零权限真实节奏律动** | 没有录音权限时，律动依然跟着鼓点走 —— 见下一节，这是本项目最核心的技术点 |
| **一套代码全尺寸** | 手机 / 平板 / 车机，横屏 / 竖屏 / 宽屏 / 窄屏；横竖屏切换不重启、不丢播放状态 |
| **数据只在本机** | 收藏、历史、订阅、下载、歌词偏移全部落在本地，卸载即清空；不上传、不埋点、不申请账号 |

---

## 🎵 核心：没有录音权限，律动也要跟得上音乐

频谱默认开启，提供**柱状 / 镜面 / 波形**三种样式。数据按四级自动降级，「我的 · 关于」页会实时显示当前用的是哪一级：

| 级别 | 数据源 | 触发条件 | 随音乐节奏 |
|---|---|---|---|
| ① | **真实 FFT** — `Visualizer` 读播放混音 | 有 `RECORD_AUDIO` 且收到非零能量帧 | ✅ 声音本身 |
| ② | **真实节奏包络** — `MediaCodec` 解码同一份音频 | 无录音权限 / 真 FFT 失效，音频可解码 | ✅ 声音本身 |
| ③ | 装饰算法律动 | 音频不可解析（加密 / 无解码器） | ❌ 仅保证不静止 |
| ④ | 待机呼吸 | 暂停 | — |

**第 ② 级是关键**：旧做法在拿不到 `RECORD_AUDIO` 时用「歌曲 hash → 固定 BPM + sin 波」合成，与正在播放的声音没有任何数据联系，节奏必然对不上。现在改为用 `MediaCodec` 解码**同一份音频**（本地文件，或在线流由 `StreamProxy` 落盘的缓存），计算 32 段能量随时间的变化，播放时按 `MediaPlayer` 真实进度查表回放。

- **不启用麦克风、不录音、不联网二次拉流**，也不新增任何权限类型（`RECORD_AUDIO` 早就在清单里声明）
- **首次启动会主动弹一次系统原生「录音」授权框**：排在免责协议与存储权限之后、三框串行不叠加；授权则第 ① 级真 FFT 从第一首歌起可用，拒绝也照常走第 ② 级律动，且全生命周期只问一次、不反复骚扰
- `FFT_SIZE = 1024`、`HOP = 512`（50% 重叠窗）、`BANDS = 32`；长音频用 `SpectrumDsp.StrideMerge` **逐 hop 做 FFT、逐段取峰值合并**，避免跳帧造成的采样间隙把整击鼓点漏掉
- 切歌 / seek / 单曲循环立即对齐；节奏表量化后缓存到 `getCacheDir()/beat/`，单份上限 24 MB、只留最近 3 份
- 拒绝授权 ≠ 一定拿不到真 FFT：4.4 是安装期授权、部分 ROM / 车机不校验，所以一律先尝试挂载，再由「是否真有非零帧」判定有效性

---

## 📱 界面与适配

同一套代码，布局**结构**由 `layout/`（横屏双栏）与 `layout-port/`（竖屏单栏）决定，所有**尺寸**（字号 / 封面 / 按钮 / 内边距 / 左右栏比例）走 `dimens.xml`，按 `sw600dp`、`sw720dp` 三档自动缩放。

| 场景 | 效果 |
|---|---|
| 手机竖屏（窄屏） | 单栏：播放卡片在上、列表在下 |
| 手机横屏 | 双栏：列表 + 播放器，紧凑 |
| 平板（≥600dp） | 大封面、大字号、左 40% / 右 60% |
| 车机 / 10″+ 大屏（≥720dp） | 超大字号 + ≥60dp 触控目标；`touchscreen required=false`，无触摸屏设备也能装 |

```
┌──────────────────────────────────────────────────────────────┐
│ ● Muriel音乐         [全部源][网易云][QQ][酷狗][B站]      [关于] │
├───────────────────────────────┬──────────────────────────────┤
│ [搜索歌曲/歌手……]      [搜索]  │            ┌────────┐         │
│ (周杰伦)(林俊杰)(薛之谦)…      │            │  封面   │         │
│ [发现][收藏][历史][本地][我的] │            └────────┘         │
│  1  晴天    周杰伦   网易 4:29 │             晴天              │
│  2  花海    周杰伦   B站  ↓45% │             周杰伦            │
│                               │     ●──────○──────  1:02/4:29 │
│  找到 38 首 · 长按下载          │     [◀◀]  [ ▶ ]  [▶▶]        │
│                               │  [收藏][顺序][歌词][悬浮][下载] │
└───────────────────────────────┴──────────────────────────────┘
```

### 🎨 四套皮肤

由 27 个设计令牌驱动全部材质，设置里点一下即换整套视觉，**播放不中断**，桌面小部件与弹窗同步换肤。

| 皮肤 | 气质 | 适合 |
|---|---|---|
| **极光**（默认） | 青绿→电蓝流动、玻璃卡片 | 夜间长听 |
| **琥珀** | OLED 纯黑 + 暖金流光 | 省电、极简 |
| **珍珠** | 奶油白 + 雾蓝柔光 | 白天、车内强反光 |
| **霓虹** | 品红 × 电青对撞 | 个性、夜场 |

### 🧩 桌面小部件（三尺寸）

| 尺寸 | 内容 |
|---|---|
| 1×2 迷你横条 | 封面 + 歌名 + 播放/暂停 |
| 2×2 方形 | 封面 + 歌名 + 歌手 + 进度条 + 三键控制 |
| 2×4 宽幅 | 方形全部信息 + **当前行高亮歌词 + 下一行预告** |

三套布局的背景、描边、光晕、文字、按钮图标全部**按当前皮肤运行时自绘**；拖动拉伸自动切换布局，播放状态 / 进度 / 歌词在宿主桌面进程里持续刷新。

---

## 🧰 功能一览

| 分类 | 功能 |
|---|---|
| **音源** | 网易云 / QQ音乐 / 酷狗 / B站 四源搜索与直链；**跨源兜底**（酷狗直链付费、VIP 曲目自动用「歌名+歌手」去其它源找同一首）；抖音热歌随机电台（失败自动跳过）；自定义音源脚本 |
| **歌词** | 网易 / QQ / 酷狗三源，优先取歌曲本源平台；整屏滚动居中、当前行高亮、**点击任意行跳转**；`±0.5s` 偏移校准（按歌曲记住）；严格匹配（版本标签 + 歌手 + 时长），避免现场版配录音室版；皮肤化换源弹窗、自定义搜索词 |
| **播放** | 前台 Service + 通知栏控制 + 音频焦点；耳机线控 / 蓝牙 / 车机方向盘按键；车机第三方桌面可用 `com.muriel.music.CTRL_*` 广播控制；退出记忆播放（队列 + 进度 + 模式）；无放回随机洗牌、末曲自动续抓；睡眠定时、自动切歌、均衡器、音量增强 +3/+6/+9 dB |
| **下载 / 本地** | 断点续传（并发 2、自动重试、进度 + 速度、后台完成通知）；目录三级兜底（公共目录 → App 外部目录 → 私有目录）；全盘扫描本机音乐、后台解码时长；播放优先本地文件 |
| **交互** | 上滑加载更多、下拉换一批、搜索历史、收藏、历史（最近 100 首）、歌单订阅、悬浮窗（可拖动、两态折叠、长按 1.5 秒切换自动收回）、语音搜索、音源命中率统计、直链缓存、跨源去重 |
| **其它** | 开机自动播放（默认关）、屏幕常亮、大字模式、深浅主题、`READ_CLIPBOARD` 复制直链 |

---

## 🏗️ 技术规格

| 项 | 值 |
|---|---|
| 语言 / 构建 | Java 8 语言特性（匿名内部类，无需脱糖）、AGP 3.5.3、Gradle 5.6.4、JDK 8、Build Tools 28.0.3 |
| SDK | `minSdk 19` / `targetSdk 24` / `compileSdk 28` |
| 包名 | `com.muriel.music`（可与旧版 `com.niuniu.music` 并存安装） |
| 源码规模 | 53 个 Java 文件，约 2.13 万行；APK 约 596 KB（debug 签名） |
| 网络 | `HttpURLConnection` 自封装（自动解 gzip、跨协议重定向、TLS 1.2 兼容层）；`usesCleartextTraffic=true` |
| 音频链路 | `MediaPlayer` + 内置本地流代理 `StreamProxy`（`127.0.0.1` 随机端口，把 B站仅 HTTPS 的音频流转成 HTTP 给 4.4 播放，支持 Range 透传） |
| 频谱链路 | `Visualizer` → `SpectrumCapture` → `SpectrumDsp`（纯 Java FFT / 32 段分频）→ `BeatTrack`（`MediaCodec` 解码节奏表）→ `SpectrumData` 四级优先级 |
| 质量 | `lint` **0 Error / 0 Fatal**，全量 javac 通过，离线单测 **31/31** |

### 工程取舍

- **`targetSdk 24` 是刻意保留**，不是疏漏：Android 14 要求 `targetSdk ≥ 23`、Android 15/16 要求 `≥ 24` 才允许安装，24 刚好满足；升到 26+ 会触发后台服务限制、31+ 会触发 `PendingIntent` 可变性 flag 与后台前台服务限制，需要重构整个播放链路。相关取舍固化在 `app/lint.xml`。
- 运行时兼容由代码侧处理：8.0+ 用 `startForegroundService` / `NotificationChannel`，4.4~7.1 走旧分支。
- 本包为本地分发，不提交应用商店，故不适用商店的 target API 上架要求。

### 目录结构（节选）

```
MurielMusic/
├── README.md / README.en.md / index.html   # 介绍页
├── CHANGELOG.md / UI-DESIGN.md / OPTIMIZE.md
├── tools/                                  # 离线单测与校验脚本
└── app/src/main/
    ├── AndroidManifest.xml
    ├── java/com/muriel/music/
    │   ├── MainActivity.java               # 界面 / 搜索 / 播放控制
    │   ├── PlayerService.java              # 前台播放服务 / 通知 / 频谱挂载
    │   ├── SourceApi.java                  # ★ 多音源调度与跨源兜底
    │   ├── NeteaseSource / QqSource / KugouSource / BiliSource
    │   ├── Lyrics.java / LyricPickerDialog # ★ 三源歌词与换源
    │   ├── SpectrumDsp / BeatTrack / SpectrumData / SpectrumCapture
    │   ├── StreamProxy.java                # 本地流代理
    │   ├── Downloader / DownloadStore / Store / ImageLoader
    │   ├── NiuWidgetProvider / WidgetUpdater / WidgetArt
    │   └── Skins / SkinManager / AmbientBackground / ...
    └── res/                                # layout / layout-port / values-sw600dp / sw720dp / drawable-*dpi
```

---

## 🚀 快速开始

### 直接安装

下载 [`MurielMusic-v2.3.5-debug.apk`](MurielMusic-v2.3.5-debug.apk)（约 596 KB，debug 签名），在 Android 4.4+ 设备上安装即可。首次启动需阅读并同意《学习免责协议》，之后可在「我的 · 关于」复查。

> 侧载安装到国产 ROM（荣耀 / 华为 / 小米等）后若出现「无网络」，请先在 **系统管家 → 流量管理 → 应用联网** 中为该应用勾选「移动数据」与「WLAN」，并关闭省流量模式与电池优化。这是系统侧管控，不是 App 兼容性问题。

### 自行编译

```bash
cd MurielMusic
gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

环境：JDK 8 + Android SDK Platform 28 + Build Tools 28.0.3。老 Gradle 若报 `Failed to load native library 'libnative-platform.so'`，加 `-Dorg.gradle.native=false`。

---

## 🔌 音源说明

| 能力 | 接口 |
|---|---|
| 网易搜索 | `music.163.com/api/search/get/web`（四级端点降级 + `os=pc` Cookie） |
| 网易直链 | `music.163.com/song/media/outer/url?id=ID.mp3`（302；`/404` 表示无版权） |
| 网易歌词 | `music.163.com/api/song/lyric`（`lrc` 空时用 `tlyric/klyric` 兜底） |
| QQ 搜索 / 直链 / 歌词 | `c.y.qq.com/soso/fcgi-bin/client_search_cp`、`u.y.qq.com/cgi-bin/musicu.fcg`、`c.y.qq.com/lyric/fcgi-bin/...` |
| 酷狗搜索 | `mobilecdn.kugou.com/api/v3/search/song`（官方直链已转付费，播放走跨源兜底） |
| B站 搜索 / 音频 | `api.bilibili.com/x/web-interface/search/type`（需 `buvid3`）→ `view?bvid` → `playurl?fnval=16` → `dash.audio[].baseUrl`（**仅 HTTPS**，走 `StreamProxy`） |

> 这些均为第三方公开接口，可能随时变动或受限。接口失效时 App 会自动换端点、换音源，状态栏显示各源的失败原因；本项目不提供、不托管任何音频内容。

---

## 📚 文档

| 文件 | 内容 |
|---|---|
| [`CHANGELOG.md`](CHANGELOG.md) | 逐版本改动与修复记录（含 P0/P1 审查结论） |
| [`UI-DESIGN.md`](UI-DESIGN.md) | 皮肤引擎、设计令牌、布局规范 |
| [`OPTIMIZE.md`](OPTIMIZE.md) | 性能优化与功能清单 |
| [`index.html`](index.html) | 可发布到 GitHub Pages 的双语介绍页 |

---

## ⚠️ 声明

> **仅供个人学习研究使用。** 本软件为非商业自用作品，用于学习 Android 原生开发；音乐、歌词、封面等内容均来自第三方公开网络接口，版权归原权利人所有。本软件**不存储、不上传**任何音频，收藏 / 历史 / 订阅 / 下载等数据仅保存在本机，卸载即清空。
>
> 请勿用于任何商业用途或大批量分发。作者不对第三方接口的可用性、内容合法性及使用后果承担责任。

<div align="center">

**[English](README.en.md) · 简体中文 · [在线介绍页](https://murielmax.github.io/MurielMusic/)**

</div>
