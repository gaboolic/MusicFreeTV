# K歌 & Android TV 改造说明

本次改造在 MusicFree（`gaboolic/MusicFreeTV` 分支）基础上，新增了「轻量 K歌」与「Android TV（遥控器）」两大能力。

> 本文档描述新增能力、代码位置、配置项与已知限制。构建前请先执行 `npm install`（当前工作区未安装依赖，未能本地编译验证）。

---

## 一、K歌

### 功能范围（轻量版）

- **全屏大字歌词跟唱**：进入 K歌页后展示当前歌曲的滚动歌词。
- **原唱 / 伴奏 / 纯伴奏 切换**：
  - 原唱：正常播放当前歌曲。
  - 伴奏：优先复用已绑定的伴奏；否则用插件音源搜索伴奏版本。
  - 纯伴奏：用本地人声消除生成伴奏。
- **麦克风耳返**：实时监听麦克风（不回放录音、不做评分），可通过 `+/-` 或滑块调节音量。
- 切换伴奏**不会改变“当前歌曲”**，因此歌词、封面、歌单/历史记录、歌词联动都不受影响。

### 伴奏来源

1. **优先复用插件音源**：以 `${标题} ${歌手} ${关键词}` 在现有可搜索插件里搜索，
   关键词包含「伴奏 / 纯伴奏 / 纯音乐 / 卡拉OK / off vocal / instrumental / karaoke」等；
   按标题、歌手相似度打分，低于阈值才认为命中。命中后会缓存在媒体附加属性中，下次直接复用。
2. **本地人声消除（兜底）**：找不到伴奏时，对本地音频做中置声道抵消 `out = L - R` 生成纯伴奏 WAV。
   - 若歌曲不是本地文件，会先下载到缓存目录再处理。
   - 该方案对“居中的人声”有效，属于轻量兜底；效果要求高时可后续接入 AI 人声分离。

### 使用入口

- 首页「K歌」按钮（竖向/横向布局都有）。
- 首页侧边栏「K歌」。
- 播放页右上角音符按钮。

### 相关配置（设置 → 基础设置 → K歌）

| 配置项 | 说明 | 默认 |
| --- | --- | --- |
| `karaoke.autoSearchAccompaniment` | 进入 K歌自动搜索伴奏 | 开 |
| `karaoke.autoVocalRemoval` | 找不到伴奏时本地消除人声 | 关 |
| `karaoke.defaultMode` | 进入 K歌默认模式（原唱/伴奏） | 原唱 |
| `karaoke.micMonitor` | 默认开启耳返 | 关 |
| `karaoke.micVolume` | 耳返音量 0~100 | 60 |

---

## 二、Android TV

核心 React Native **不包含** TV 遥控器焦点能力（`hasTVPreferredFocus` / `onFocus` / `TVEventHandler`
都在 `react-native-tvos` 分支里）。为了不替换整个 `react-native` 依赖，这里自建了一套轻量焦点系统。

### 组成

- **原生按键转发**：`MainActivity.dispatchKeyEvent` 在电视设备上拦截方向键/确认键，
  通过 `MusicFreeTvKey` 事件转发到 JS，并消费事件避免系统默认焦点行为。
- **JS 焦点管理**：`src/core/tv/focusManager.ts` 维护可聚焦元素注册表，
  收到方向键时按「主方向距离 + 垂直偏移」打分做空间导航。
- **可聚焦控件**：`src/components/base/focusable.tsx`（`Focusable`），
  自动测量位置、注册、显示聚焦高亮，并响应确认键。
- **聚焦自动滚动**：`src/hooks/useFocusAutoScroll.ts`，遥控器移动到屏幕外列表项时自动滚动。
- **TV 应用声明**：`AndroidManifest.xml` 增加 Leanback feature、`LEANBACK_LAUNCHER` 分类与 `tv_banner`。

### 已接入焦点的界面

- 首页：导航栏（菜单/搜索）、K歌等操作按钮、歌单标签页、歌单列表、歌曲列表。
- 播放页：返回、K歌、播放控制（播放/暂停、上一首/下一首、循环、播放列表）。
- K歌页：返回、模式切换、播放控制、耳返开关与音量。
- 通用 `ListItem`：所有使用它的列表（搜索结果、歌单详情、本地音乐等）自动可聚焦。

---

## 三、主要文件

### 新增（JS/TS）

| 文件 | 作用 |
| --- | --- |
| `src/pages/karaoke/index.tsx` | K歌页面 |
| `src/core/karaoke/index.ts` | K歌核心：伴奏搜索、模式切换、耳返、人声消除调度 |
| `src/native/karaoke/index.ts` | 原生能力封装（KaraokeAudio / VocalRemover） |
| `src/native/tvEvent/index.ts` | 遥控器按键事件封装 |
| `src/core/tv/focusManager.ts` | TV 空间焦点管理 |
| `src/components/base/focusable.tsx` | 可聚焦控件 |
| `src/hooks/useTVKeyNavigation.ts` | 遥控器按键 → 焦点移动 |
| `src/hooks/useFocusAutoScroll.ts` | 聚焦自动滚动 |
| `src/hooks/useIsTV.ts` | 电视设备判断 |

### 新增（Android）

| 文件 | 作用 |
| --- | --- |
| `.../karaoke/KaraokeModule.kt` | 麦克风耳返（AudioRecord → AudioTrack） |
| `.../karaoke/VocalRemoverModule.kt` | 人声消除（MediaCodec 解码 + 中置抵消 → WAV） |
| `.../karaoke/KaraokePackage.kt` | 原生模块注册 |
| `res/drawable/tv_banner.xml` | TV 启动器横幅（占位，建议替换为 320x180 PNG） |

### 主要改动

- `src/core/trackPlayer/index.ts`：新增 `setPlaySourceOverride` / `clearPlaySourceOverride`，
  用于在**不切换当前歌曲**的前提下替换播放音源（K歌伴奏）。
- `src/entry/bootstrap/bootstrap.ts`：注入并初始化 K歌核心。
- `src/core/router/*`、`src/pages/home/**`、`src/pages/musicDetail/**`、`src/pages/setting/**`：入口与配置。
- `android/.../MainApplication.kt`、`AndroidManifest.xml`：注册原生模块、TV 声明与录音权限。

---

## 四、构建与运行

```bash
npm install
npm run android          # 手机 / 电视（USB 调试）
npm run build-android    # 打 release 包
```

> 说明：Kotlin 编译与打包未在本地完整验证（本机 Android SDK 未安装 `ndkVersion 26.1.10909125`，
> 见 `android/build.gradle`），请首次构建时重点关注 Kotlin 编译与原生模块注册。

---

## 四、已验证项（本地实测）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 依赖安装 | `npm ci` | ✅ 1737 packages |
| 类型检查 | `npx tsc --noEmit` | ✅ 0 error |
| 代码规范 | `npx eslint src` | ✅ 0 error（111 个既有风格 warning） |
| JS 全量打包 | `npx react-native bundle --platform android` | ✅ 成功 |
| 焦点导航单测 | `npx jest src/core/tv` | ✅ 6 passed |
| 伴奏打分单测 | `npx jest src/core/karaoke` | ✅ 6 passed |
| Kotlin 编译 | `./gradlew :app:compileDebugKotlin` | ✅ BUILD SUCCESSFUL（含新增原生模块） |
| XML/JSON 校验 | Python `xml.dom.minidom` / `json` | ✅ AndroidManifest、tv_banner、三语言 json 均合法 |

为支持测试，新增 devDependency `@types/jest`，并在 `tsconfig.json` 的 `types` 中加入 `"jest"`。

### 构建前置条件（重要）

1. **JDK 版本**：本项目部分依赖（如 `react-native-image-colors`）的 Java 目标为 17，
   使用 JDK 21 会出现 `Inconsistent JVM-target compatibility ... (17) and (21)`。
   请用 **JDK 17** 构建，或显式指定：
   ```bash
   ./gradlew :app:assembleDebug -Dorg.gradle.java.home="<path/to/jdk-17>"
   ```
2. **release 签名**：`android/app/build.gradle` 的 release 配置会读取 `android/keystore.properties`。
   该文件（gitignore）不存在时，项目在**求值阶段**就会报 `path may not be null or empty string`。
   本地调试可先创建：
   ```
   RELEASE_STORE_FILE=debug.keystore
   RELEASE_STORE_PASSWORD=android
   RELEASE_KEY_ALIAS=androiddebugkey
   RELEASE_KEY_PASSWORD=android
   ```
3. **NDK**：根 `build.gradle` 指定的 `ndkVersion 26.1.10909125` 需已安装（本机仅有 27.x/28.x，
   但 `compileDebugKotlin` 不依赖 NDK，故不影响本次验证）。

---

## 五、已知限制 / 后续可做

- **耳返啸叫**：麦克风外放容易产生回授，建议佩戴耳机；`VOICE_RECOGNITION` 音源在部分设备自带降噪，
  但不能完全避免。后续可加入更激进的 AEC/门限。
- **人声消除效果**：中置抵消对非居中/混响强的人声效果有限；如需更好效果可接入离线 AI 分离模型。
- **TV 名单滚动**：已对 `MusicList`、首页歌单列表接入自动滚动，其它自定义列表可按需复用
  `useFocusAutoScroll`。
- **TV 文本输入**：为避免影响输入法，方向键被消费，`Enter` 未拦截；电视端搜索体验仍以触摸遥控器为主。
- **TV 横幅**：`tv_banner.xml` 为矢量占位，部分 TV 启动器偏好位图，建议替换为 320x180 的 PNG。
