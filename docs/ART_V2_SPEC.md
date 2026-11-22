# 美术资产规格 V2（几何科幻 UI 装饰 + 时代插图）

- 仅写 `public/**` 与 `docs/ART_V2.md`、`public/art-manifest-v2.json`；不得写 src。
- 风格：硬科幻工业终端，近黑/冷青/琥珀；几何（同心圆、弧、平行四边形、切角框、刻度、排线）。参考明日方舟/终末地的“装置化 UI”气质，但必须原创，不使用/不下载受版权保护素材。
- 生成手段（按可用性优先级）：
  1) 本地程序化（Python/Pillow 若无 Python 则 Node + SVG/Canvas 库？项目无 canvas 依赖；可用纯 SVG 手写 + PowerShell/Node 生成 SVG/PNG；PNG 可用 Edge headless 将 SVG 渲染为截图？也可直接交付 SVG 由浏览器渲染）；
  2) 如 `generate_image` 工具可用则尝试；本次环境此前失败，可再试 1–2 次，失败即放弃；
  3) **不要**尝试登录/操作即梦网站（无浏览器自动化权限）；如需 AI 生图，在报告中向 lead 说明需要用户手动操作。
- 交付清单（SVG 优先，浏览器可直接用；文件名固定）：
  1. `public/ui/orbit-ring.svg`：同心圆/弧线 HUD 环（viewBox 512×512，青色细线，可 CSS 旋转）；
  2. `public/ui/frame-corner.svg`：切角面板角标（可九宫格拉伸用，四角样式）；
  3. `public/ui/hatch.svg`：45° 排线纹理（48×48，可平铺）；
  4. `public/ui/slash-divider.svg`：斜切分隔条；
  5. `public/ui/parallelogram-tab.svg`：平行四边形页签底型；
  6. `public/ui/radar.svg`：雷达同心圆+扫描扇形；
  7. `public/backgrounds/menu-bg-v2.jpg|png`：主菜单背景（几何星图+三恒星+观察站剪影，近黑/冷青，无文字）；
  8. `public/backgrounds/nebula-v2.jpg|png`：深空网格星云底图；
  9. `public/images/era-1-v2 ... era-5-v2`：5 张时代插图（E1 原始部落+观星台；E2 农业城邦；E3 蒸汽电力工业；E4 超算/航天；E5 星际殖民/聚变），16:9，统一冷青+琥珀；
  10. `public/icons/era-1.svg ... era-5.svg`：时代徽记（同心环+几何符号）；
  11. 可选：`public/ui/noise.png` 胶片噪点（128×128，低对比）。
- 每个文件生成后真实校验尺寸/格式/文件存在；写出 manifest（路径/尺寸/来源/用途）。
- 若只能用 SVG，也要保证浏览器显示效果完整；不要交付空白/损坏文件。
