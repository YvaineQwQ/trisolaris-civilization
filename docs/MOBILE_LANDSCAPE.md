# 手机端横屏适配（v1.4.1）

## 目标

手机横屏时不得出现：主菜单被截断、新纪元表单挤出屏幕、弹窗被压扁、按钮互相覆盖、页面级横向滚动。
竖屏（390×844）与桌面（1280×720 / 1600×900）视觉保持不变。

## 生效条件

```css
@media (max-width: 1024px) and (orientation: landscape) and (max-height: 560px)
```

另有一条 `max-height: 360px` 的“特别矮横屏”规则（568×320 等老设备）。

## 横屏布局策略

| 区域 | 横屏策略 |
| --- | --- |
| 主菜单 | 左侧标题/说明 + 右侧 5 个按钮双栏；隐藏装饰、页脚压缩，整体一屏可见 |
| 新纪元初始化 | 左侧表单 + 右侧星系预览双栏，表单/预览各自内部滚动；标题与步骤条压缩 |
| 弹窗（科技树/政治/事件/说明/存档） | 全屏、吸顶标题、内容区独立滚动，避免 390px 高度下被压扁 |
| 左侧文明档案 | 全屏抽屉，页签/工具条紧凑，内容独立滚动 |
| 右侧决策栏 | 全屏页签页，页头/页签高度压缩，正文独立滚动 |
| 终端抽屉 | 停在 44px 底部导航上方，按钮最小 44px，内部滚动 |
| HUD | 压缩黄色刊头、告警带与顶部按钮；隐藏移动端摘要行，把高度留给主舞台 |
| 底部导航 | 图标化（隐藏文字标签），高度 44px + 安全区，五个入口仍可点 |
| 刘海/挖孔 | 菜单、弹窗、抽屉、HUD、底部导航使用 `env(safe-area-inset-*)` 左右安全区 |

## 验收尺寸

| 视口 | 覆盖内容 | 结果 |
| --- | --- | --- |
| 844×390（iPhone 14/15 横屏） | 菜单、新纪元、主游戏、文明档案、决策栏、政治、科技树、终端 | 通过 |
| 667×375（iPhone SE 横屏） | 菜单、新纪元、主游戏、终端、科技树 | 通过 |
| 568×320（老款小屏横屏） | 菜单、新纪元、主游戏 | 通过，HUD 自动隐藏刊头/告警带 |
| 390×844（竖屏回归） | 主游戏 | 通过，无变化 |
| 1280×720（桌面回归） | 主游戏 | 通过，无变化 |

## 实机截图

- `artifacts/flm-final-land-menu.png`
- `artifacts/flm-final-land-newgame.png`
- `artifacts/fv-final-land-game.png`
- `artifacts/l3-land3-dossier.png`
- `artifacts/l3-land3-decision.png`
- `artifacts/l3-land3-politics.png`
- `artifacts/l4-land4-techbook844.png`
- `artifacts/l4-land4-techbook667.png`
- `artifacts/l4-land4-terminal.png`
- `artifacts/l667-land667-game.png`
- `artifacts/l568g-land568-game.png`
- `artifacts/fv-final-portrait-game.png`
- `artifacts/fv-final-desktop-game.png`

## 质量

- 0 exception / 0 console error / 0 failed request。
- 弹窗内容区无页面级横向溢出（667×375 科技树实测 pageScrollW=667）。
- `tsc --noEmit` 0 错误；15 测试文件 / 219 用例通过；vite build 通过。

## 已知边界

- 568×320 这类极小横屏下，Canvas 内 3D 天体标签会尽量避让，但空间有限时仍可能贴近；DOM 层 UI 不重叠、按钮均可点。
- 真机 iOS Safari 的地址栏动态高度由 `100dvh` 与安全区处理，未做长时间真机回归。
