# 启动动画 PV《纪元存续理事会》— v1.4 实现与集成说明

> 范围：docs/V4_SPEC.md §1。实现文件：src/startup/**、public/startup/**（徽章由 emblem-art 交付）。
> 集成：src/main.ts 已由 lead 接入；src/ui、src/game、src/core、package.json 均未改动。

## 1. 概述

冷启动时播放一段六幕可交互启动动画：黑幕徽章 → 过曝洗白 → 白纸技术档案底板 →
五步交互式存续授权 → 银白色散故障揭幕 → 终幕「欢迎，观测者」。
全屏 fixed overlay，Canvas 2D 负责星点/准星/轨道/扫描/过曝/故障，DOM 负责文字排版与按钮；
结束后移除 overlay 并 resolve，不读写任何游戏状态。

技术入口：

~~~ts
import { runStartup } from "./startup";
const result = await runStartup(); // "completed" | "skipped"
~~~

- 时长：正常节奏约 15–20s（符合 14–20s 要求）；黑幕默认停留 4.8s 后自动进入第二幕，
  第 1、2 步等待玩家按钮/Enter/Space，第 3–5 步自动（可点击加速 3.2×）。
- 默认本会话只播放一次（sessionStorage 键 trisolaris.startup.v14）。
- 支持 Esc / 右上 SKIP 跳过；?skipstartup=1 由 main.ts 直接跳过（不进入本模块）。
- prefers-reduced-motion：关闭自转/星点闪烁/扫描线/故障，时长压缩到约 45%。
- 音效：WebAudio 实时合成轻提示；默认需首次用户手势后才允许发声，无音频设备时静默降级。

## 2. 六幕序列

| 幕 | 画面 | 中文主字 / 英文 | 交互 | 实现时长 |
|---|---|---|---|---|
| ① 黑幕 | 纯黑 + 极淡星点 + 银白徽章（≥240px）+ 中央准星环慢转 | 纪元存续理事会 / EPOCH CONTINUITY COUNCIL / 观测 · 守护 · 存续 | 点击任意处 / 按钮 / Enter / Space 推进；无操作 4.8s 自动进入第二幕 | 入场 ≤1.5s 全部可见，停留约 4.8s |
| ② 过曝洗白 | 白色过曝光团扫过黑幕，转到白纸 | —（画外 transition） | 无 | 约 0.55s |
| ③ 技术档案底板 | 白纸墨字工业画册：标题「文明存续授权」、档案编号/时间/观测站、三体轨道示意图、逐行启动自检终端、右侧授权序列控制台（五格进度） | 文明存续授权 / CIVILIZATION CONTINUITY PROTOCOL | 无（自动 6 行自检逐行打印） | 约 2.3s |
| ④ 五步存续授权 | 右栏控制台：Ⅰ观测权限 → Ⅱ档案确认 → Ⅲ轨道载入 → Ⅳ模型校验 → Ⅴ授权通过 | 观测权限申请 / OBSERVATION ACCESS REQUEST 等五组 | 第 1 步按钮/Enter/Space；第 2 步「确认档案」按钮/Enter；第 3–5 步自动，点击加速 | 交互步等待玩家；自动三步约 7.2s |
| ⑤ 色散故障揭幕 | 银白/钢蓝扫描线 + 水平撕裂 + 过曝闪烁（无红色），黑幕接回 | — | 无 | 约 0.5s |
| ⑥ 终幕 | 纯黑 + 徽章 + 欢迎语 + 小字 + 进入按钮 | 欢迎，观测者 / WELCOME, OBSERVER；三颗太阳仍在舞蹈，理事会与你同在。 | Enter / 点击 CTA 进入游戏；15s 无操作兜底自动完成 | 入场 ≤1.5s |

第 4 幕五步细节：

1. ① 观测权限申请 OBSERVATION ACCESS REQUEST — 按钮「授予观测权限 GRANT OBSERVATION ACCESS」
2. ② 观测者档案确认 OBSERVER IDENTITY VERIFICATION — 档案卡：观测者代号 OBSERVER-01、
   权限级别 存续观测、档案编号 ECC-0731-Δ、授权范围 三体星系；按钮「确认档案 CONFIRM IDENTITY」
3. ③ 三体轨道载入 THREE-BODY ORBIT LOAD — 三颗恒星逐行 LOCKED + 进度条 + 轨道示意图补全
4. ④ 预测模型校验 PREDICTION MODEL VERIFY — 星历残差/李雅普诺夫指数/预测置信度/混沌漂移数值滚动 + PASS
5. ⑤ 存续授权通过 CONTINUITY CLEARANCE GRANTED — 信号黄 CLEARANCE GRANTED 章 + 五格全亮

替换确认：原「伟大智能统辖 / GREAT INTELLIGENT OVERLORDSHIP」已全部替换为
「纪元存续理事会 / EPOCH CONTINUITY COUNCIL」；标语为「观测 · 守护 · 存续」；
终幕为「欢迎，观测者 / WELCOME, OBSERVER」。

## 3. 交互与键盘

| 操作 | 行为 |
|---|---|
| 点击黑幕任意处 / CTA 按钮 | 第一幕推进到过曝 |
| Enter / Space | 第一幕推进；第 1、2 步推进（鼠标聚焦在按钮上时交给按钮原生激活） |
| 第 3–5 步时点击画面 | 加速（clock × 3.2，直到该步完成） |
| Esc | 跳过整段动画（resolve "skipped"） |
| 右上 SKIP / 跳过 | 跳过整段动画；allowSkip:false 时隐藏且 Esc 无效 |
| Tab / Shift+Tab | 在 SKIP、CTA、当前步按钮之间循环（焦点陷阱） |
| 终幕 Enter / 点击「进入游戏」 | resolve "completed" |
| ?skipstartup=1 | main.ts 不调用 runStartup（不显示动画、不写 sessionStorage） |
| 播放过本会话后再次加载 | runStartup 立即 resolve "skipped"（不显示 overlay） |

无障碍：role="dialog" aria-modal，aria-live 播报幕/步；按钮 ≥44px 触摸区；
prefers-reduced-motion 遵循系统设置；按钮可用键盘聚焦。

## 4. 公开 API（src/startup/index.ts）

~~~ts
runStartup(opts?: StartupOptions): Promise<"completed" | "skipped">
replayStartup(opts?: StartupOptions): Promise<"completed" | "skipped"> // 强制重播
getStartupHandle(): StartupHandle | null   // { phase, step, result, advance(), skip() }
hasPlayedStartupThisSession(): boolean
clearStartupSession(): void
dismissStartupBootVeil(): void              // 移除 index.html 首屏黑幕
STARTUP_SESSION_KEY = "trisolaris.startup.v14"
STARTUP_EVENT = "trisolaris:startup-phase"  // window CustomEvent，detail={phase,step}
~~~

StartupOptions：assetBase、remember(默认 true)、force、speed(默认 1，调试用)、
sound(false 静音 / "auto" 默认手势后启用)、allowSkip(默认 true)、observerName、
reducedMotion(true|false|"auto")、onPhase(progress)。

StartupPhase：black | wash | archive | auth | glitch | welcome | done；auth 时 step∈1..5。

## 5. 集成方式

### 5.1 main.ts（已由 lead 接入）

~~~ts
import { getStartupHandle, replayStartup, runStartup } from "./startup";

window.__TRISOLARIS__ = {
  // ...
  replayStartup: (opts) => replayStartup({ force: true, ...opts }),
  startupHandle: () => getStartupHandle(),
};

const bootParams = new URLSearchParams(window.location.search);
const bootAutostart = bootParams.get("autostart") === "1";
const skipStartup = bootParams.get("skipstartup") === "1"
  || (bootAutostart && bootParams.get("startup") !== "1");
if (!skipStartup) {
  void runStartup().then((r) => console.info("[trisolaris] startup", r))
    .catch((e) => console.warn("[trisolaris] startup failed", e));
}
~~~

模块自身 import 了 ./startup.css 并实例化 Canvas/WebAudio，不需要额外样式引入；
getStartupHandle/replayStartup 已可被帮助入口或 E2E 使用。

### 5.2 index.html 首帧黑幕（**需 lead 补一步，本模块无法在加载前生效**）

启动模块在 dev 下需要 4–6s 加载，期间会短暂露出游戏白纸界面。为消除首帧白屏，
请在 index.html 的 <body> 最前面加入下面片段（纯内联，无网络依赖）：

~~~html
<!-- v1.4 启动动画首帧黑幕：由 src/startup 的 dismissStartupBootVeil() 移除 -->
<div id="tri-boot-veil" aria-hidden="true"></div>
<style>
  #tri-boot-veil { position: fixed; inset: 0; z-index: 2147482999; background: #000; }
</style>
<script>
  (function () {
    var params = new URLSearchParams(location.search);
    var autostart = params.get("autostart") === "1";
    var skip = params.get("skipstartup") === "1" || (autostart && params.get("startup") !== "1");
    if (skip) {
      var v0 = document.getElementById("tri-boot-veil");
      if (v0 && v0.parentNode) v0.parentNode.removeChild(v0);
      return;
    }
    // 兜底：脚本异常 / 模块加载失败时 15s 后强制撤幕，避免永久黑屏
    setTimeout(function () {
      var v = document.getElementById("tri-boot-veil");
      if (v && v.parentNode) v.parentNode.removeChild(v);
    }, 15000);
  })();
</script>
~~~

本模块在 mount 时、runStartup 判定本会话已播放时、以及 teardown 时都会调用
dismissStartupBootVeil() 移除该黑幕；因此正常路径无需 main.ts 额外处理。

## 6. 文件清单

| 文件 | 说明 |
|---|---|
| src/startup/index.ts | 六幕状态机、DOM 编排、交互/键盘/焦点、sessionStorage、Canvas/音频生命周期、公开 API |
| src/startup/scene.ts | Canvas 2D 场景：星点、准星环（正下方缺口）、徽章兜底绘制、三体轨道图、过曝/扫描线/银白故障/授权光晕 |
| src/startup/audio.ts | WebAudio 振荡器合成提示音（click/advance/load/verify/granted/welcome/skip），无音频文件 |
| src/startup/markup.ts | 六幕静态 DOM 模板（无插值；动态文案用 textContent 写入） |
| src/startup/startup.css | 全部样式（黑幕银白 + 白纸墨黑 + 信号黄；桌面/平板/手机/矮屏/横屏；reduced-motion） |
| src/startup/preview.html | 本地静态预览页（dev-only，不属于生产入口；Vite 下可直接访问） |
| public/startup/council-emblem.svg | 理事会徽章（emblem-art 程序化生成，黑底银白，见 docs/STARTUP_ART.md） |
| public/startup/council-emblem-mark.svg | 小徽记（左上角 26px 使用） |
| public/startup/reticle-ring.svg | 准星环（缺口正下方；本模块用作 110s 慢转外环，缺失时退化为 Canvas 准星） |
| public/startup/council-emblem-2048-black.png / -transparent.png | 徽章 2048 位图（黑底/透明，备用/印刷；本动画只用 SVG） |
| artifacts/startup-v14/** | 本任务浏览器 QA 截图、驱动脚本、静态预览产物（非生产代码） |

## 7. 素材来源与原创声明

- 徽章/小徽记/准星环：emblem-art 子任务用脚本程序化生成（几何精确 SVG），
  生成过程与命令见 docs/STARTUP_ART.md；本模块只引用、不修改这些文件。
- Canvas 星点、准星刻度、三体轨道图、过曝、扫描线、银白色散故障、授权光晕：
  本模块以 Canvas 2D 程序化绘制，无任何第三方素材。
- 字体：全部使用系统自带字体（Bahnschrift/微软雅黑/Cascadia Mono 等回退链），无 webfont、无网络请求。
- 音效：WebAudio 振荡器实时合成，无音频文件。
- 未下载或使用任何版权素材。

## 8. 视觉实现要点

- 黑幕 / 终幕：纯黑底 + 银白（#E6EBF0 系）+ 极淡星点；中央准星环两段圆弧、底部 6 点钟缺口，
  外环 110s 慢转、Canvas 刻度环 0.045 rad/s 自转。
- 徽章：council-emblem.svg 为透明底 1024 矢量（emblem-art v2），直接叠在光晕/星点 canvas 上，
  再放大 1.52 倍；容器 clamp(240px, 30vh, 380px)，保证桌面 ≳240px、清晰可见。
  黑底位图（council-emblem-2048-black.png）与透明位图（-transparent.png）已随资产交付，本动画只用 SVG。
- 白纸档案：纸白 #F4F1EA + 墨黑 #111 + 唯一信号黄 #FDFD1F（信号黄只用于当前步骤刻线、
  授权通过章与状态块，面积 <10%）；点阵 + 内框发丝线两种纹理；直角/发丝线/等宽微标。
- 故障：银白/钢蓝（#DCE5EF / #7D9FBE）色散条 + clip-path 撕裂，不用红色。
- 移动端：≤820px 单栏（文档区收缩、控制台优先），≤480px 进一步压缩；按钮 44px+。

## 9. 验收记录

环境：Windows + Edge headless（CDP 9343–9358）+ 静态预览页（http://127.0.0.1:5199/，
由 artifacts/startup-v14/serve-preview.mjs 提供；src/startup/preview.html 亦可在 dev 5173 打开）。
测试时刻本机 CPU 100%（其它子任务并行），截图采集耗时 1–4s/张，故瞬时幕（过曝/故障）的
像素证据有随机性；结构性验收以 CDP 轮询到的 phase/step 与 DOM 尺寸为准。

### 9.1 六幕截图（1600×900）

| 幕 | 文件 | 说明 |
|---|---|---|
| ① 黑幕 | artifacts/startup-v14/su-static-act1-black.jpg | 完整黑幕（徽章/中文主字/英文逐字/标语/CTA/准星环）— 尺寸修正前 |
| ① 黑幕（修正后·纯黑） | artifacts/startup-v14/su10-clean-black.png | 尺寸修正 + 透明底徽章 v2：纯黑幕、无黑方块；徽章槽 270px（≥240）、主字 clamp(30,4.4vw,58) 全部到位，英文/标语/CTA 可见。（QA 温度：本机 CPU 满载时截图会落在过曝转场，故该帧通过临时隐藏 .su-fx 过曝层截取纯黑构图；DOM 状态实测 zhOpacity=1、emblemBox=270、is-cta=true） |
| ① 黑幕（过曝中同构图） | artifacts/startup-v14/su8-final-act1.png | 同一构图的过曝转场帧，可核对 4.8s 自动推进时刻的画面 |
| ② 过曝 | artifacts/startup-v14/su-static-act2-wash.jpg | 过曝白场 |
| ③ 档案底板 | artifacts/startup-v14/su-static-act3-archive.jpg | 白纸档案：标题/编号/时间/三体轨道图/6 行自检/右侧授权序列 |
| ④ 步 1 | artifacts/startup-v14/su-static-act4-step1.jpg | 观测权限申请 + 按钮 |
| ④ 步 2 | artifacts/startup-v14/su-static-act4-step2.jpg | 观测者档案卡（OBSERVER-01/权限/编号/范围） |
| ④ 步 3 | artifacts/startup-v14/su-static-act4-step3.jpg | 三体轨道载入进度 + LOCKED |
| ④ 步 4 | artifacts/startup-v14/su-static-act4-step4.jpg | 预测模型校验数值滚动 |
| ④ 步 5 | artifacts/startup-v14/su-static-act4-step5.jpg | CLEARANCE GRANTED（信号黄章） |
| ⑤ 故障 | artifacts/startup-v14/su-static-act5-glitch.jpg | 银白/钢蓝撕裂（画面在纸面状态被切条） |
| ⑥ 终幕 | artifacts/startup-v14/su-static-act6-welcome.jpg | 欢迎，观测者 / WELCOME, OBSERVER / 进入按钮 |
| 结束 | artifacts/startup-v14/su-static-final-game.jpg | overlay 移除后露出主界面 |

报告：artifacts/startup-v14/su-static-report.json（11 张截图、无 exception、无 console error、
无 failed request；layoutDesktop overflow = 0）。

### 9.2 交互 / 时长 / 健壮性

- 第 1 步：按钮点击推进（driver click-step1）；第 2 步：Enter 推进（driver enter-step2，成功进入 step3）；
  终幕：Enter 完成（finish-enter → overlay 移除，body 恢复）。
- Esc：su7 场景中 key=Escape 后 900ms 内 overlay 移除（hasRoot=false, gone=true），无异常。
- 黑幕自动推进：控制台 black → wash 的时间差约 4.8s（+0.7s mount 后于 +5.5s 进入 wash），
  符合「黑幕停留 4–5s」；入场文字/CTA 使用真实时间定时器，1.42s 内全部出现（不依赖 rAF 帧率）。
- 徽章尺寸：DOM 实测 .su-emblem-slot = 270×270 @1600×900（clamp(240px,30vh,380px)），
  徽章图形放大 1.52×，screen 混合去除资产黑底。
- 总时长（正常节奏）：黑幕 4.8s + 过曝 0.55 + 档案 2.3 + 授权自动三幕 ~7.2 + 故障 0.5 +
  终幕入场 1.5 + 玩家两次操作 —— 约 15–20s，与 V4_SPEC「14–20s」一致。
- 音频：静态 QA 默认 sound=false（不创建 AudioContext）；真实页面首次手势后创建；
  无音频设备/自动播放拒绝/浏览器不支持时 try-catch 静默降级，不抛异常。
- tsc：全仓 node .\node_modules\typescript\bin\tsc --noEmit 退出码 0；
  src/startup 专项 tsc（artifacts/startup-v14/tsconfig.startup.json）退出码 0。
- 首帧白屏：由 index.html 黑幕片段消除（§5.2，需 lead 合并；未合并时模块加载期会短暂露出游戏界面）。
  模块加载/判定本会话已播放/teardown 时都会移除该黑幕。

### 9.3 未覆盖

- 因 CPU 满载，第二轮「六幕全量重截」只补到黑幕（su8 过曝帧 / su10 纯黑帧）与过曝白场（su3/su6），其余五幕沿用
  尺寸修正前的 su-static 系列；修正只影响黑幕徽章/文字尺寸与标题大小，不影响白纸三幕布局。
  建议 lead 在 dev 5173 上快速目检一次黑幕 4–5s 内的徽章 + 标题（代码保证见 §9.2）。
- 移动端 390×844 的最终截图未在本轮补拍（布局规则已实现：≤820 单栏、≤480 压缩、按钮 44px+）；
  建议总验收时用 Edge 设备模拟截一张黑幕 + 一张授权页。
- sessionStorage 跳过：静态预览页故意 remember=false 且每次 clear，无法在该页验证；
  逻辑在 runStartup 内（读/写 sessionStorage），dev 5173 由 main.ts 调用时生效，建议 lead 刷新一次验证。

## 10. 已知缺口 / 后续

1. index.html 首帧黑幕片段尚未合并（§5.2）；合并后模块会自动移除，无需 main.ts 改动。
2. 透明度：council-emblem.svg 已是透明底（emblem-art v2，2026-11-21 21:14 更新），
   本模块不再使用 mix-blend-mode; 若换回黑底位图需自行加混合模式或黑底容器。
3. 音效没有 UI 静音开关（默认手势后轻提示；如需完全静音由集成方传 sound:false）。
4. 音频在无设备/自动播放拒绝时静默降级，不做提示。
5. 第 1、2 步必须玩家操作，若无人操作会停在授权页（有 SKIP/Esc）；终幕 15s 无操作自动完成。
6. 未跑全仓 E2E（按任务约束），仅 tsc + 本模块专项浏览器 QA；dev 5173 全量集成由 lead 总验收。
7. 移动端按 390×844 与横屏压缩布局验证；iPad/折叠屏未逐机型验证。
8. sessionStorage 只记本会话；隐私模式下写入失败会自动降级为「每次都播」。
9. 系统字体回退链在不同 Windows/macOS 上字面略有差异（无 webfont 的刻意选择：启动零抖动）。
10. 资源加载失败有兜底：徽章缺失时 Canvas 2D 画程序化三体+月牙弧+箭头；准星缺失时 Canvas 画准星环。
