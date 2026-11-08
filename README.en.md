<div align="center">

# Muriel Music · Muriel 音乐

**A multi-source music player with zero dependencies, no backend, and Android 4.4 support**

**English** · [简体中文](README.md) · [Live page](https://MurielMax.github.io/MurielMusic/)

![version](https://img.shields.io/badge/version-2.3.4-informational)
![Android](https://img.shields.io/badge/Android-4.4%2B-3DDC84)
![dependencies](https://img.shields.io/badge/dependencies-0-orange)
![backend](https://img.shields.io/badge/backend-none-blue)
![Java](https://img.shields.io/badge/Java-8-red)

</div>

> Search, stream-URL resolution, lyrics, artwork, and beat analysis **all happen inside the app**.
> No server required. Built purely on Android platform APIs with **zero third-party dependencies**.

Muriel Music runs from Android 4.4 (API 19) all the way to current releases, packing multi-platform aggregated search, local playback, home-screen widgets, and spectrum visualisation into an APK under 600 KB. It is a personal project written to study native Android development — a local player with no account, no sign-up, and no data leaving the device.

---

## ✨ Why it stands out

| Highlight | Detail |
|---|---|
| **Zero third-party dependencies** | No OkHttp, Glide, ExoPlayer, Jetpack, or Kotlin. HTTP, image cache, JSON, FFT, and LRC parsing are all implemented in-house; the dependency block is empty |
| **No backend** | Search / URL / lyrics endpoints for all four providers are built into the app. There is no server, API key, or relay to maintain |
| **Genuine Android 4.4 support** | `minSdk 19`, with dedicated legacy branches kept intact: TLS 1.2, media-button re-registration, `TYPE_PHONE` overlay windows, all-PNG icons, and a local HTTPS proxy |
| **Real beat sync without mic permission** | The visualiser follows the drums even when `RECORD_AUDIO` is denied — see the next section, the core technical contribution of this project |
| **One codebase, every screen** | Phone / tablet / car head unit, portrait / landscape / wide / narrow; orientation changes do not restart the Activity or interrupt playback |
| **Data stays on-device** | Favorites, history, subscriptions, downloads, and lyric offsets are stored locally and removed on uninstall. No upload, no analytics, no account |

---

## 🎵 Core: beat sync that survives a denied mic permission

The spectrum is on by default with **bar / mirror / waveform** styles. Data falls back through four levels, and the *About* page shows which one is active in real time:

| Level | Source | Trigger | Follows the music |
|---|---|---|---|
| ① | **Real FFT** — `Visualizer` on the playback mix | `RECORD_AUDIO` granted and non-zero energy frames received | ✅ The audio itself |
| ② | **Real beat envelope** — `MediaCodec` decoding the same audio | No mic permission / real FFT unavailable, audio decodable | ✅ The audio itself |
| ③ | Decorative synthesis | Audio cannot be parsed (encrypted / no decoder) | ❌ Only prevents a flat line |
| ④ | Idle breathing | Paused | — |

**Level ② is the key.** The old approach, used when `RECORD_AUDIO` was unavailable, synthesised motion from `song hash → fixed BPM + sine wave` — mathematically unrelated to the sound being played, so it could never line up with the beat. Now `MediaCodec` decodes **the very same audio** (a local file, or the on-disk cache written by `StreamProxy` for online streams), computes the 32-band energy envelope over time, and plays it back by looking up the `MediaPlayer`'s real position.

- **No microphone, no recording, no extra network fetch, no new permission.**
- `FFT_SIZE = 1024`, `HOP = 512` (50% overlap), `BANDS = 32`. For long audio, `SpectrumDsp.StrideMerge` runs an FFT on **every hop** and merges bands by **peak value**, so downsampling never leaves a gap that could swallow an entire drum hit.
- Track change / seek / repeat-one re-align immediately. The quantised envelope is cached under `getCacheDir()/beat/`, capped at 24 MB per entry with the 3 most recent retained.
- A denied permission does not necessarily mean no real FFT: API 19 grants at install time and some ROMs / head units do not enforce the check, so the app always tries to attach first and judges validity by whether non-zero frames actually arrive.

---

## 📱 UI & adaptation

One codebase: layout **structure** comes from `layout/` (landscape, two-pane) and `layout-port/` (portrait, single column), while every **dimension** (text size, artwork, buttons, padding, pane ratio) lives in `dimens.xml` and scales across `sw600dp` / `sw720dp` buckets.

| Scenario | Result |
|---|---|
| Phone, portrait (narrow) | Single column: player card on top, list below |
| Phone, landscape | Two panes: list + player, compact |
| Tablet (≥600dp) | Large artwork and type, 40% / 60% split |
| Car head unit / 10″+ (≥720dp) | Extra-large type and ≥60dp touch targets; `touchscreen required=false` so touchless devices can install |

```
┌──────────────────────────────────────────────────────────────┐
│ ● Muriel Music     [All][NetEase][QQ][Kugou][Bilibili] [About] │
├───────────────────────────────┬──────────────────────────────┤
│ [Search songs / artists…] [Go] │            ┌────────┐         │
│ (Jay Chou)(JJ Lin)(Eason Chan) │            │ Artwork │         │
│ [Discover][Fav][History][Local]│            └────────┘         │
│  1  Sunny Day   Jay Chou  NE  │             Sunny Day         │
│  2  Flower Sea  Jay Chou  Bili│             Jay Chou          │
│                               │     ●──────○──────  1:02/4:29 │
│  38 found · long-press to save │     [◀◀]  [ ▶ ]  [▶▶]        │
│                               │  [Fav][Order][Lyrics][Float]  │
└───────────────────────────────┴──────────────────────────────┘
```

### 🎨 Four skins

27 design tokens drive every surface. Switching skins in Settings restyles the whole app **without interrupting playback**, and widgets and dialogs follow along.

| Skin | Character | Best for |
|---|---|---|
| **Aurora** (default) | Teal → electric blue, glass cards | Long late-night listening |
| **Amber** | OLED black + warm gold glow | Battery saving, minimalism |
| **Pearl** | Cream white + misty blue | Daytime, glare in the car |
| **Neon** | Magenta × cyan | Expressive, nightlife |

### 🧩 Home-screen widgets (three sizes)

| Size | Content |
|---|---|
| 1×2 mini strip | Artwork + title + play/pause |
| 2×2 square | Artwork + title + artist + progress + three transport keys |
| 2×4 wide | Everything above + **highlighted current lyric line + next-line preview** |

Backgrounds, strokes, glow, text, and button icons are **drawn at runtime from the active skin**. Resizing a widget switches layout automatically; playback state, progress, and lyrics keep refreshing inside the launcher process.

---

## 🧰 Feature overview

| Area | Features |
|---|---|
| **Sources** | NetEase Cloud / QQ Music / Kugou / Bilibili search and stream resolution; **cross-source fallback** (paid Kugou links and VIP tracks are re-found on other providers by title + artist); Douyin hot-song shuffle radio with auto-skip on failure; custom source scripts |
| **Lyrics** | Three providers (NetEase / QQ / Kugou), preferring the song's own platform; full-screen centred scrolling with highlighted current line, **tap any line to seek**; `±0.5s` offset calibration remembered per song; strict matching (version tag + artist + duration) so a live recording never gets a studio LRC; skin-aware source picker with custom search terms |
| **Playback** | Foreground service + notification controls + audio focus; wired headset / Bluetooth / car steering-wheel media keys; third-party car launchers can send `com.muriel.music.CTRL_*` broadcasts; resume-on-relaunch (queue + position + mode); shuffle without replacement, auto-refill at the end of the queue; sleep timer, auto-skip, equaliser, +3/+6/+9 dB loudness boost |
| **Downloads / local** | Resumable downloads (2 concurrent, auto-retry, progress + speed, background completion notification); three-tier directory fallback (public → app-external → private); full-device music scan with background duration decoding; local files preferred for playback |
| **Interaction** | Pull-up to load more, pull-down for a new batch, search history, favorites, history (last 100), playlist subscriptions, draggable floating window (two states, long-press 1.5s to toggle auto-collapse), voice search, per-source hit-rate stats, stream URL cache, cross-source de-duplication |
| **Extras** | Auto-play on boot (off by default), screen-on toggle, large-text mode, light/dark themes, copy stream URL to clipboard |

---

## 🏗️ Technical specs

| Item | Value |
|---|---|
| Language / build | Java 8 language features (anonymous classes, no desugaring needed), AGP 3.5.3, Gradle 5.6.4, JDK 8, Build Tools 28.0.3 |
| SDK | `minSdk 19` / `targetSdk 24` / `compileSdk 28` |
| Package | `com.muriel.music` (can be installed alongside the legacy `com.niuniu.music`) |
| Size | 52 Java files, ~20.7k lines; APK ~594 KB (debug-signed) |
| Networking | In-house `HttpURLConnection` wrapper (auto gzip, cross-protocol redirects, TLS 1.2 compat layer); `usesCleartextTraffic=true` |
| Audio path | `MediaPlayer` + built-in local proxy `StreamProxy` (random `127.0.0.1` port; converts Bilibili's HTTPS-only audio to HTTP for API 19 `MediaPlayer`, with Range passthrough) |
| Spectrum path | `Visualizer` → `SpectrumCapture` → `SpectrumDsp` (pure-Java FFT / 32 bands) → `BeatTrack` (`MediaCodec` beat envelope) → `SpectrumData` four-level priority |
| Quality | **0 lint Errors / 0 Fatal**, full `javac` pass, **31/31** offline unit tests |

### Engineering trade-offs

- **`targetSdk 24` is deliberate, not an oversight.** Android 14 requires `targetSdk ≥ 23` to install, and Android 15/16 require `≥ 24`; 24 sits exactly on that floor. Going to 26+ triggers background service limits, and 31+ triggers `PendingIntent` mutability flags and background foreground-service restrictions — all of which would require rebuilding the playback chain. These decisions are documented in `app/lint.xml`.
- Runtime compatibility is handled in code: 8.0+ uses `startForegroundService` / `NotificationChannel`; 4.4–7.1 uses the legacy branches.
- This build is distributed locally and is not submitted to any app store, so store target-API policies do not apply.

### Project layout (excerpt)

```
MurielMusic/
├── README.md / README.en.md / index.html   # intro pages
├── CHANGELOG.md / UI-DESIGN.md / OPTIMIZE.md
├── tools/                                  # offline tests & verification scripts
└── app/src/main/
    ├── AndroidManifest.xml
    ├── java/com/muriel/music/
    │   ├── MainActivity.java               # UI / search / playback control
    │   ├── PlayerService.java              # foreground service / notification / spectrum
    │   ├── SourceApi.java                  # ★ multi-source scheduling & fallback
    │   ├── NeteaseSource / QqSource / KugouSource / BiliSource
    │   ├── Lyrics.java / LyricPickerDialog # ★ three-source lyrics & picker
    │   ├── SpectrumDsp / BeatTrack / SpectrumData / SpectrumCapture
    │   ├── StreamProxy.java                # local streaming proxy
    │   ├── Downloader / DownloadStore / Store / ImageLoader
    │   ├── NiuWidgetProvider / WidgetUpdater / WidgetArt
    │   └── Skins / SkinManager / AmbientBackground / ...
    └── res/                                # layout / layout-port / values-sw600dp / sw720dp / drawable-*dpi
```

---

## 🚀 Getting started

### Install directly

Download [`MurielMusic-v2.3.4-debug.apk`](MurielMusic-v2.3.4-debug.apk) (~594 KB, debug-signed) and install it on any Android 4.4+ device. The first launch asks you to read and accept the *Study Disclaimer*; you can review it later under *Mine · About*.

> If the app reports "no network" after sideloading on a Chinese ROM (HONOR / HUAWEI / Xiaomi / etc.), first enable both **Mobile data** and **WLAN** for it under *System Manager → Data usage → App network access*, and turn off Data Saver and battery optimisation. That is an OS-level policy, not an app compatibility issue.

### Build from source

```bash
cd MurielMusic
gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 8 + Android SDK Platform 28 + Build Tools 28.0.3. If an older Gradle reports `Failed to load native library 'libnative-platform.so'`, add `-Dorg.gradle.native=false`.

---

## 🔌 Provider endpoints

| Capability | Endpoint |
|---|---|
| NetEase search | `music.163.com/api/search/get/web` (four-level endpoint fallback + `os=pc` cookie) |
| NetEase stream | `music.163.com/song/media/outer/url?id=ID.mp3` (302; `/404` means unavailable) |
| NetEase lyrics | `music.163.com/api/song/lyric` (falls back to `tlyric/klyric` when `lrc` is empty) |
| QQ search / stream / lyrics | `c.y.qq.com/soso/fcgi-bin/client_search_cp`, `u.y.qq.com/cgi-bin/musicu.fcg`, `c.y.qq.com/lyric/fcgi-bin/...` |
| Kugou search | `mobilecdn.kugou.com/api/v3/search/song` (official streams are paywalled; playback goes through cross-source fallback) |
| Bilibili search / audio | `api.bilibili.com/x/web-interface/search/type` (needs `buvid3`) → `view?bvid` → `playurl?fnval=16` → `dash.audio[].baseUrl` (**HTTPS only**, via `StreamProxy`) |

> These are third-party public endpoints and may change or become rate-limited at any time. The app switches endpoints and providers automatically and shows per-source failure reasons in the status line. This project does not provide or host any audio content.

---

## 📚 Documentation

| File | Contents |
|---|---|
| [`CHANGELOG.md`](CHANGELOG.md) | Version-by-version changes and fixes (including the P0/P1 audit) |
| [`UI-DESIGN.md`](UI-DESIGN.md) | Skin engine, design tokens, layout conventions |
| [`OPTIMIZE.md`](OPTIMIZE.md) | Performance work and feature inventory |
| [`index.html`](index.html) | Bilingual landing page, ready for GitHub Pages |

---

## ⚠️ Disclaimer

> **For personal study and research only.** This is a non-commercial personal project written to learn native Android development. Music, lyrics, and artwork come from third-party public network endpoints and remain the property of their respective rights holders. The app **does not store or upload** any audio; favorites, history, subscriptions, and downloads live only on the device and are removed on uninstall.
>
> Do not use it commercially or redistribute it at scale. The author assumes no responsibility for the availability or legality of third-party endpoints, or for any consequences of use.

<div align="center">

**English · [简体中文](README.md) · [Live page](index.html)**

</div>
