# RENDER3D_V4 —— 3D 近景、贴图与 3D HUD 统一（v1.4 §4.2）

> task-22 / render3d-engineer。写入范围：`src/render3d/**`、`artifacts/3d-v14/**`、本文档。
> 未改 `src/ui/**`、`src/game/**`、`src/core/**`、`src/main.ts`、`package.json`；贴图由 texture-art 生成（程序化，无版权素材），本任务仅消费。

## 1. 文件与职责

| 文件 | 内容 |
| --- | --- |
| `index.ts` | 近景状态机（进入/切换/退出/选中同步）、点击拾取→近景、Esc、HUD 装配、贴图订阅、软件渲染检测、帧率统计、QA 调试钩子 |
| `camera-3d.ts` | near 模式：0.85s easeOutCubic 补间（enterNear/exitNear/trackNearTarget/setPreset 平滑回全景）、近景缩放限位、近景裁剪面 |
| `texture-3d.ts`（新增） | 贴图惰性加载（manifest 发现 + 扩展名回退 + sRGB/wrap/anisotropy/mipmap）、海洋遮罩推导、alpha 检测、模块级缓存/释放 |
| `near-view-3d.ts`（新增） | 近景取景参数（视觉半径/入场方位/缩放限位）+ 观测信息卡数据（纯函数，不碰 DOM/three） |
| `stars-3d.ts` | 近景高分段球体 + 自发光等距贴图 + 日冕；未知恒星不用写实贴图；**修复恒星拾取代理双重位移 bug** |
| `planet-3d.ts` | 昼面 Phong + 海洋高光、云层壳、夜面灯光遮罩、大气 Fresnel 壳；远近两档几何 |
| `hud-3d.ts` | 重写为纸白卡片 HUD + 近景卡 + 目标切换条 + 返回全景按钮 + 性能提示 |
| `hud-print.css`（新增） | 3D HUD/标签印刷语言（纸白+墨黑+单一信号黄、直角/微圆角、等宽微标），随 3D 模块加载注入 |
| `labels-3d.ts` | 天体标签改纸白芯片；近景自动隐藏；碰撞宽度计入内边距 |
| `shared-3d.ts` | `ViewerFrame` 增加 `nearBody / nearRadius / quality` |

## 2. 近景交互

- **点击天体（3 恒星 + 母星）→ 近景**：全景下点击到可拾取天体时先 `onPick` 同步选中，再由相机 **0.85s easeOutCubic** 插值（方位角/极角/距离/轨道中心同时过渡，无瞬移），规格要求 0.6–1.0s。
- **取景**：视觉半径 = 场景推荐半径 ×0.022（恒星）/0.020（母星），相机距离 3.3R（球体约占画面高度 78%）；不暴露未观测真实尺寸（信息卡只显示观测字段）。
- **母星默认朝向**：按“观测到的最近恒星方向”绕 Y 偏 38°、抬高 ~22°，默认看到 2/3 昼面 + 晨昏线；可拖拽到夜面看灯光。
- **近景操作**：左键拖拽绕天体旋转（极角限位）；滚轮缩放限位 **1.55R–9R**；右键平移在近景忽略（避免拖出取景）；每帧跟随天体观测位置。
- **返回全景**：① Esc（渲染器捕获阶段拦截并 stopImmediatePropagation，仅近景生效，不误触主 UI 暂停）；② 点击空白（近景天体圆盘内点击不算空白：投影+像素半径判断）；③ 近景卡「返回全景 · ESC」/ × 按钮；④ UI 的「复位 / 俯视 / 侧视 / 自由」在近景下也会 0.85s 平滑回全景。
- **切换目标**：近景卡切换条「恒星 A/B/C/母星」或点击可见的其他天体，同样 0.85s 平滑切换。
- **一致性**：近景只动相机，不改模拟时间/选中/种子；外部取消选中 → 平滑退出；外部改选 → 平滑切换。2D/3D 切换由主 UI 管理（切到 2D 销毁 3D 渲染器，选中与时间保持）。
- **修复**：恒星拾取代理球原本是 root 子节点却又复制了一次 root 世界坐标（实际偏移 2×），导致点击恒星拾取不到；v1.4 改为局部原点，点击三颗恒星可靠进入近景（QA 报告验证）。

## 3. 贴图与材质

### 3.1 加载（`texture-3d.ts`）
- **惰性**：仅某天体首次进入近景时请求其贴图；全景 0 请求。恒星各 1 张；母星 day/clouds/night + 可选 water-mask（normal 未启用）。
- **路径发现**：先取 `/textures/manifest.json` 递归扫描 `*.jpg|png`，按 stem 匹配；manifest 缺失/滞后回退 `/textures/<stem>.jpg`→`.png`（云层优先 png）。全部失败只记状态并继续程序化回退材质，不黑屏。
- **色彩**：颜色贴图 `SRGBColorSpace`；`wrapS=RepeatWrapping`（经度无缝）、`wrapT=ClampToEdgeWrapping`；mipmap + anisotropy(≤16)。
- **缓存**：模块级单例，最后一个 3D 渲染器销毁时统一 `disposeTextureLibrary3D()`；无 DOM 环境状态 unsupported。

### 3.2 恒星
近景高分段球体（硬件 72×48 / 软件 40×26）+ `MeshBasicMaterial.map`（无光照=自发光）+ 自转 0.055rad/s；外圈两层加法混合程序化辉光（日冕+白热核心），近景按表面半径收窄；贴图缺失回退观测色球体。**known=false 的恒星不使用写实贴图**（不伪造表面），信息卡提示“仅确认存在”。

### 3.3 母星
- 昼面 `MeshPhongMaterial` + day 贴图；`specularMap` 用 texture-art 的 `planet-water-mask.jpg`（白=水），缺失时由 day 贴图程序化推导；shininess 52 形成海洋高光。
- 云层独立壳（×1.012）transparent + depthWrite:false；PNG 直通 alpha 用 NormalBlending，无 alpha 回退 Additive；相对球体 0.135rad/s 漂移。
- 夜面：夜面贴图作 emissiveMap，`onBeforeCompile` 注入“视图空间法线·恒星方向”夜面遮罩，只在背光侧点亮城市灯光，不污染昼面；注入失败自动跳过。
- 大气：Fresnel 壳（ShaderMaterial、BackSide、Additive、pow(1−N·V,3.1)），近景才启用；全景保留廉价辉光 Sprite。
- 贴图未就绪：观测色调哑光表面 + 云层/夜面逐项回退（可看但不伪造）。

### 3.4 来源
全部贴图由 texture-art 用 `scripts/gen-planet-textures.py`（numpy 值噪声/Worley + Pillow，seed 20261121）程序化生成，2048×1024 等距圆柱、横向严格无缝；来源/许可/校验见 `public/textures/manifest.json` 与 `docs/TEXTURES_V4.md`。未下载任何版权素材。

## 4. 3D HUD / 标签（与主 UI 一致）

- 新增 `src/render3d/hud-print.css`，在 `index.ts` `import "./hud-print.css"`（随 3D 模块动态注入，不改 src/ui）；token 复用主 UI 的 `:root` 变量并带本地回退。
- 左上观测状态卡（状态/年份/观测等级/选中/高度提示，标题前 7px 信号黄方块为唯一黄色点缀）；右下视角卡（预设、操作提示、AU 比例尺、**性能提示行**：近景/全景、fps、硬件加速/软件渲染降级、贴图 x/6）；右上近景卡（观测信息、目标切换条、返回按钮、观测边界提示）；天体标签为纸白芯片+墨黑/灰字（等宽数字）。全部卡片 pointer-events:none，仅按钮/切换条可点，不遮挡画布拾取。
- 保留 2D/3D 切换、图例、标注、性能提示（属于 src/ui，本任务未改动，只保证同一套纸白/墨黑/信号黄语言）。

## 5. 性能

- **软件渲染检测**：初始化读 `WEBGL_debug_renderer_info/RENDERER`，命中 SwiftShader/llvmpipe/softpipe → quality="low"，HUD 显示“软件渲染 · 降级分段”。
- **近景降级**：隐藏星穹/网格/轨迹/不确定度/轨道面/脉冲/距离标注/HTML 标签并跳过其同步；近景球体分段硬件 96×64（母星）/72×48（恒星），软件 56×36/40×26；云层/大气仅近景可见；贴图惰性 + 共享缓存；DPR/画布像素上限沿用 v1.3。
- **补帧**：主循环暂停补帧时，相机补间/阻尼未收敛或近景贴图仍在加载会连续 RAF 补帧直到稳定（不常驻）。
- **实测**：headless Edge + SwiftShader 且宿主高负载时近景/全景约 10–17fps（软件渲染基线，截图脚本中近景 3 秒采样低至 ~1.3fps 属极端并发）；硬件 GPU 预期 45fps+（近景仅 2~3 球体 + 少量 Sprite，draw call 少于全景）。详细数值见 `artifacts/3d-v14/v14-report.json` 的 performance。
- **WebGL 不可用**：仍返回 no-op，2D 与模拟不受影响。

## 6. 数据边界（不泄露真值）

`buildNearInfo()` 只读 `RenderScene3D` 字段：恒星 `name/color/radiusAU/mass/tempK/sigmaAU/confidence/known/pos`（光谱型由观测色温派生，仅展示）；母星 `tempC/habitability/radiusKm/sigmaAU/pos`。缺失字段显示“未测/未观测”并提示观测缺口；不 import game/physics，不读模拟真值；卡片固定提示「仅显示观测数据 · 不含模拟真值」。

## 7. 验收与复现

- tsc：`node .\node_modules\typescript\bin\tsc --noEmit` → 0 错误。
- 真实浏览器（dev 5173，无头 Edge+CDP，1600×900）：
  `node artifacts/3d-v14/capture-3d-v14.mjs`
  流程：autostart → 3D → 用画布上的 QA 调试钩子 `canvas.__trisolarisR3D.state()/project(id)` 取天体屏幕坐标 → CDP 真实鼠标点击 → 依次验证全景/恒星 A 近景（记录 0.6–1.0s 过渡采样）/拖拽旋转/滚轮缩放/Esc 回全景/母星近景/返回按钮/目标切换 A、B、C、母星/近景帧率采样；写 `v14-report.json`（过渡采样、每步状态、贴图状态、切换前后 meta、console 错误与失败请求）。
- 截图（1600×900，JPEG，`artifacts/3d-v14/`，已人工核对可用）：
  - `v14-00-2d-view`（2D 对照）、`v14-01-panorama`（3D 全景，纸白 HUD/标签可见）、`v14-05-return-panorama-esc`、`v14-08-return-panorama-button`（返回全景）；
  - `v14-02-near-star-a`（点击恒星 A 近景：0.85s 平滑拉近成功，近景卡/返回按钮/切换条可见；此帧贴图为加载中的程序化回退材质）、`v14-03`（拖拽旋转）、`v14-04`（滚轮缩放）；
  - `v14-06-near-planet`（点击母星近景：近景卡字段、大气边缘光可见；同样为贴图尚未就绪的回退材质）；
  - `v14-11/12/13/14`（提前 fetch 预载贴图后再次进入近景：loader 状态显示 day/clouds/night/star-b 全部 `loaded`、无 404；但该软渲染 + 高负载会话的截图出现异常放大/材质异常，见已知缺口 1，不作为验收图）。
  - `v14-report.json` / `v14-textured-report.json`：每步状态、贴图状态、切换前后 meta、console 错误与失败请求。
- 调试钩子：`getRenderer3DDebug()` 与 `canvas.__trisolarisR3D`（抗 HMR 模块实例重复）返回 `{near,nearRadius,quality,camera,textures,renderer,project(bodyId)}`。

## 8. 已知缺口 / 风险

1. **验收环境为软件渲染且宿主高负载（最重要缺口）**：
   - 贴图首次加载在 QA 会话内可能耗时数十秒，导致首张近景截图仍是程序化回退材质；预载后 loader 状态确认 day/clouds/night/star-a/star-b 均已 `loaded` 且无 404，但同一会话截图出现“近景球体异常放大/贴图材质异常”的画面（疑似 SwiftShader 下 2048 纹理上传或 Phong 夜面遮罩在极端低帧率下的渲染状态问题）；
   - 因此**近景贴图视觉效果未能在本机无 GPU 环境完成最终验收**，需在有硬件 GPU 的浏览器中复测（预期 <1s 加载、45fps+、贴图细节/云层/海洋高光正常）。代码路径、加载器、材质与回退均已就绪且 tsc 0 错误。
   - 近景帧率同样受软渲染限制（本机全景 10–17fps、近景 3 秒采样 1.3fps 属宿主并发负载极端值），45fps 需 GPU 机器复测。
2. **HMR/并发任务**：其他任务同时改 `src/ui` 时 dev 5173 可能整页重载；脚本已带 3D 挂载重试与暂停浮层处理，但长跑中随机事件会打开事件档案弹窗（模拟自动暂停）并进入截图，重跑或缩短流程可避免。
3. **法线贴图未启用**（`planet-normal.jpg` 已生成）：等距投影切线方向未逐版本验证，避免错误凹凸方向；`planet-water-mask.jpg` 已用于海洋高光。
4. **夜面遮罩依赖 three 内部 chunk 名**：升级大版本若改名会静默降级为夜灯叠加（try/catch，不影响运行）。
5. 近景隐藏程序化星穹（省填充率），背景为深空渐变；如需要可单独放开 `sceneRoot`。
6. 母星不在屏幕视野时需先旋转/缩放全景，或近景内用切换条直接跳转。
7. 移动端未专门适配近景手势（近景卡有 max-width/height 与小屏媒体查询）。

## 9. 变更清单

```
src/render3d/index.ts camera-3d.ts texture-3d.ts near-view-3d.ts stars-3d.ts
src/render3d/planet-3d.ts hud-3d.ts hud-print.css labels-3d.ts shared-3d.ts
artifacts/3d-v14/**（capture 脚本、截图、report JSON）
docs/RENDER3D_V4.md
```