# v1.4 需求冻结（启动动画 / 事件节奏 / UI 曲线与移动端 / 3D 近景与贴图）

## 0. 通用

- 项目根：C:\Users\hp000001\Downloads\three-body-civilization。当前 v1.3：219 测试全绿、tsc clean、dev 5173 / preview 4173 在跑。
- 不得改 lead 独占文件：`src/core/**`、`src/game/**`、`src/civilization/**`、`src/save/**`、`src/main.ts`（启动动画集成由 lead 做）、`package.json`。除非任务范围明确。
- 只改各自写入范围；中文文案；不得使用受版权保护素材；所有资源原创/程序化/AI 生成并在文档注明来源。
- 完成前 `node .\node_modules\typescript\bin\tsc --noEmit` 0 错误（若涉及 UI/渲染）；相关测试通过；send_message 汇报。

## 1. 启动动画（owner: startup-pv + emblem-art）

参考：DSH 插件 dsh-startup-secret 的六幕开机序列（黑幕徽章 → 过曝洗白 → 技术档案底板 → 交互式访问授权 → 色散故障揭幕 → 终幕欢迎），中文主字 + 英文等宽副标题逐字打出；中央环形准星慢转、底部缺口；右上 SKIP、Esc 跳过；按钮 / Enter / 空格推进；时长约 14–20 秒可跳过。

### 1.1 必须替换
- 原「伟大智能统辖 / GREAT INTELLIGENT OVERLORDSHIP」→ **「纪元存续理事会 / EPOCH CONTINUITY COUNCIL」**。
- 小队标语改为：**「观测 · 守护 · 存续」**（三体语境）。

### 1.2 理事会徽章（由 emblem-art 子智能体用工具生成，禁止手写粗糙占位）
- 三颗银白天体呈**不等边三角形**，大小略有区分（A 最大、B 次之、C 最小），银白/灰阶，轻微辉光。
- 下方一条**粗月牙形轨道弧**，开口朝上，像托盘托住三体；弧线末端有**箭头指向右上**。
- 象征：观测三体、守护文明轨迹、向存续前进。
- 背景纯黑；银白主体占画面 30%–40%；留足负空间。
- 交付：`public/startup/council-emblem.svg`（矢量，可缩放）、`council-emblem-2048.png`（透明/黑底各一版）、`council-emblem-mark.svg`（仅徽记，用于左上角小标）、可选 `reticle-ring.svg`（准星环，缺口在正下方）。SVG 必须几何精确、线宽统一、箭头清晰；PNG 由 SVG 渲染（Edge headless / Python）。
- 需要生成过程证据（脚本/命令）写入 `docs/STARTUP_ART.md`。

### 1.3 六幕序列（startup-pv 实现）
1. 黑幕：纯黑背景，徽章淡入 + 「纪元存续理事会 / EPOCH CONTINUITY COUNCIL / 观测 · 守护 · 存续」；缓慢自转准星环；星点极淡。可点击/Enter/空格推进。
2. 过曝洗白：白色过曝扫过（0.4–0.6s），转场到白纸档案底板。
3. 技术档案底板：白纸墨字工业画册，标题「文明存续授权 / CIVILIZATION CONTINUITY PROTOCOL」，档案编号、时间、三体轨道小示意图；终端逐行打印启动自检（中文 + 英文等宽）。
4. 五步交互式存续授权（第 1、2 步必须可交互；第 3–5 步自动但可加速）：
   ① 观测权限申请 `OBSERVATION ACCESS REQUEST` — 按钮/Enter/Space
   ② 观测者档案确认 `OBSERVER IDENTITY VERIFICATION` — 显示档案卡（观测者代号可随机或 "OBSERVER-01"，权限：存续观测，编号），按钮/Enter
   ③ 三体轨道载入 `THREE-BODY ORBIT LOAD` — 进度/轨道线动画
   ④ 预测模型校验 `PREDICTION MODEL VERIFY` — 数值滚动/校验通过
   ⑤ 存续授权通过 `CONTINUITY CLEARANCE GRANTED` — 点亮
5. 色散故障揭幕：银白扫描线/色散（银白/灰蓝，不要红），画面撕裂 0.3s。
6. 终幕：纯黑，徽章 + 「欢迎，观测者 / WELCOME, OBSERVER」+ 一行小字「三颗太阳仍在舞蹈，理事会与你同在。」；按 Enter/点击进入游戏。

- 右上 SKIP（可关闭/跳过），Esc 跳过；`?skipstartup=1` 直接跳过；sessionStorage 记住本次会话已播放；提供 `replayStartup()` 重播（lead 会挂到 window/帮助入口）。
- 音效：可选 WebAudio 合成轻提示（点击/推进/授权），默认静音，需用户点击后才允许发声；尊重 prefers-reduced-motion（缩短/关闭扫描与故障）。
- 键盘：Enter/Space 推进；Esc 跳过；Tab 可聚焦按钮；移动端可点。
- 技术：Canvas 2D 为主（星点/轨道/扫描/故障），DOM 负责文本排版与按钮；全屏 fixed overlay，z-index 高于 UI；结束移除并 resolve Promise；不阻塞首帧超过 100ms；不得修改游戏状态。
- 文件：`src/startup/index.ts`（`runStartup(opts): Promise<"completed"|"skipped">`）、`src/startup/startup.css`、`public/startup/**`、`docs/STARTUP.md`。不修改 src/main.ts（lead 集成）。
- 验收：真实浏览器依次截图 6 幕 + 交互按钮；Esc/跳过可用；无 console error；桌面 1600×900 与手机 390×844 均可读。

## 2. 随机事件放慢（lead 直接改）

- 事件间隔从 8–16 回合改为 **20–34 回合**；首次事件从第 5–16 回合改为 **12–22 回合**；保留链式 followUp 的延迟不变。同步更新测试与 EVENTS.md / docs。

## 3. UI 曲线美 + 移动端（owner: ui-curves-v15）

沿用现有终末地工业画册风格（白纸墨字、单一信号黄、直角/微圆角、圆形头像、胶囊分页、印刷装饰），**不要推翻重做**，重点：
- 增加同心圆/圆弧结构：时代进度弧 / 人口与稳定度环形仪表 / 资源环形摘要 / 观测视口外圈刻度弧 / 分节标题的弧形装饰 / 曲线分隔线 / 卡片角上的细弧与切线；弧形必须有信息含义（进度、关系、刻度），不做纯装饰堆叠。
- 遵守 6 条核心原则：黄色面积 ≤ 10%；主角偏心、信息靠边；形状语义统一；中文黑体+英文结构层；每屏纹理 ≤2 种；动效 0.2–0.3s 位移/擦入/明暗反转，拒绝弹跳与持续漂浮。
- 颜色只用中性 + 信号黄；不要霓虹发光/玻璃拟态。
- 移动端（≤1024 / ≤720）：左导航轨转底部导航或抽屉；主舞台单列；右决策栏变底部抽屉/全屏页签；HUD 折叠为顶栏+可展开资源条；弹窗全屏化、按钮 ≥44px 触摸区；画布按容器 resize；字号与间距用 clamp；安全区 inset；横屏/竖屏都可用；390×844、768×1024 截图验证；桌面 1600×900/1280×720 不退化。
- 文件：`src/ui/**`、`docs/UI_PRINT_V15.md`、`artifacts/ui-v15/**`。不要改 src/game、src/render3d、public/**。
- 自检：tsc 0；真实浏览器截图（桌面 + 手机）无 overflow；现有功能与 data-action 保留；新加曲线组件需真实数据绑定。

## 4. 3D 行星近景与贴图（owner: render3d-engineer + texture-art）

### 4.1 贴图（texture-art 生成，public/textures/**）
- 4 个天体，每个 2048×1024 等距圆柱（equirectangular）JPEG/PNG，高清、无明显接缝：
  - 恒星 A（银白/暖白 G 型：米白-淡金颗粒、黑子、耀斑）
  - 恒星 B（蓝白 A 型：青白-淡蓝颗粒、强耀斑）
  - 恒星 C（橙红 K/M 型：橙红颗粒、暗斑）
  - 母星（类地行星：明显海洋/大陆/海岸线/云层；另出云层透明贴图与夜面灯光贴图，可选 bump）
- 附带 `public/textures/manifest.json`（路径/尺寸/来源/用途）与 `docs/TEXTURES_V4.md`（生成方法、可复现脚本 `scripts/gen-planet-textures.py`）。
- 程序化生成（Python numpy/Pillow，允许 seed）或 AI 生成；禁止下载版权素材。恒星贴图应能映射到球体并在近景可见表面细节。

### 4.2 3D 交互（render3d-engineer）
- 3D 模式下**点击天体（三颗恒星或母星）→ 镜头平滑拉近到近景**（相机动画 0.6–1.0s，缓出），近景下可见贴图细节、表面自转、行星云层/大气边缘；显示对象信息卡（名称、类型、估算参数，严格用观测数据，不泄露真值）。
- 近景模式：鼠标拖拽绕天体旋转、滚轮缩放（限位）、Esc/点击空白/「返回全景」按钮平滑回到原机位；再次点击其他天体可切换；拾取用现有 picking。
- 母星大气层：Fresnel 边缘光/半透明大气壳，海洋高光、云层缓慢旋转；恒星用自发光 + 日冕 glow；不得破坏原有 2D/3D 数据同源与选中同步。
- 性能：纹理 lazy load（进入近景/首次需要时），近景时可降低星点数量；保持 45fps+（软件渲染可降级）；WebGL 不可用仍回退。
- **3D 视图 UI 统一**：把现有 3D HUD/图例/按钮/标签改成与主 UI 一致的“纸白+墨黑+单一信号黄+直角/微圆角+等宽微标”语言（可在 src/render3d 内加 `hud-print.css` 并在模块 import；不要改 src/ui）。保留 2D/3D 切换、图例、标注、性能提示；3D 面板不要与右侧决策栏风格割裂。
- 文件：`src/render3d/**`、`public/textures/**`、`docs/TEXTURES_V4.md`、`artifacts/3d-v14/**`；不要改 src/ui、src/game（scene 数据如需扩展先 message lead）。
- 验收：真实浏览器 3D 截图（全景 / 点击恒星近景 / 点击母星近景 / 返回全景），无 console error，点击 4 个天体都能近景；给出性能说明。

## 5. Lead 集成与总验收

- main.ts 接入 startup；事件节奏修改；全量 tsc/tests/build；桌面与移动端浏览器 QA；3D 近景 QA；更新 README/docs/stage reports；最终交付截图。
