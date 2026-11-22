# v1.6 设计系统：字体四角色 + 四类形状

实现文件：`src/ui/design-v6.css`（在 styles.css / theme-print.css 之后加载）、`public/fonts/`、`index.html`。

## 字体角色

| token | 用途 | 字体栈 |
| --- | --- | --- |
| `--font-sans` | 中文正文、标题、按钮、标签 | HarmonyOS Sans SC → Noto Sans SC → Microsoft YaHei |
| `--font-display` | 巨型英文、分页数字、结构 kicker | Archivo（wdth 125）→ Arial Black |
| `--font-latin` | 英文标题、分节名、标签、代号 | Outfit → Century Gothic |
| `--font-tech` | 数字、百分比、坐标、微标 | Space Grotesk → JetBrains Mono |
| `--font-mono` | 代码、严格等宽表格 | JetBrains Mono → Cascadia Mono |

- 自托管 woff2：Archivo（3 个 subset）、Outfit（2）、Space Grotesk（3）、JetBrains Mono（6），SIL OFL。
- 所有数字类使用 `font-variant-numeric: tabular-nums`，避免变化时左右抖动。
- 层级靠字号/字重：标题与正文同墨色，不用颜色区分层级。
- 微文字只写真实分节名、版本号、坐标；没有随机编码或假读数。

## 四类形状

| 语义 | token/实现 | 应用 |
| --- | --- | --- |
| 直角 | `--shape-none:0` | 面板、卡片、表格、弹窗、抽屉 |
| 切角 | `--cut-md:10px` / `--cut-lg:16px` | 主行动按钮、升级按钮、等级带、选区块（只切右上或对角） |
| 圆与弧 | `--shape-full:50%` | 头像、进度环、仪表、翻页钮 |
| 胶囊 | `--shape-pill:999px` | 筛选、资源/状态、事件影响 chip、底栏事件条目 |

- 按钮一族唯一圆角档 4px；主行动按钮 0 圆角 + 右上切角。
- 没有 8/12/16px 中等圆角；需要柔和时用胶囊/正圆。
- 阴影全部零偏移（`0 0 Npx`），是环境光不是投影；悬停不加大阴影、不上浮。
- 选中用填充反转、左缘 3px 色条、底边 3px 信号黄或位移，不发光。
- 默认不围整圈边框；面板/弹窗/抽屉才允许整圈边框以与背景分离。

## 落地位置

- 按钮切角：`.tri-btn-primary`、`.tri-menu-cta`、升级按钮。
- 胶囊：`.tri-chip`、`.tri-evdraw-band`、`.tri-chronicle-filter`、`.tri-ticker-item`。
- 正圆：仪表/头像/翻页钮。
- 直角：`.tri-panel`、`.tri-modal`、`.tri-chronicle`、`.tri-build-card`。
