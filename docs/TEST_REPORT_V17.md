# TRISOLARIS v1.7 测试与验收

- tsc --noEmit：0 错误
- Vitest：19 个测试文件 / 252 用例通过（性能测试偶发一次 22.6ms>20ms，单独复跑通过）
- Vite build：成功（124 modules）
- 浏览器 QA：
  - 新游戏 HUD：星历 0 年
  - 事件触发/待决：不显示暂停遮罩（即使 state.paused=true），右侧事件抽屉显示范围
  - 点击选择/提交：paused=false，抽屉关闭，无暂停页
  - 编年史：星历 1 年（整数，无浮点尾巴）
  - 30 秒报告：实际 before→after 正常弹出
  - 点击「确认结算」：report=false、modal tri-hidden、pauseOverlay tri-hidden；不再卡结算界面
  - 报告按钮在连续视图刷新中保持同一 DOM 节点（tests/ui/event-result-modal.test.ts）
  - 事件文本/数值一致性（tests/systems/event-consistency.test.ts）：休养生息不再扣粮；移民文本承认第一年粮仓见底
- 截图：artifacts/v17-01-newgame.png、v17-02-event-while-paused.png、v17-03-after-choice.png、v17-04-report.png、rfix2-report.png、rfix2-final.png
- 字体：HarmonyOS Sans SC Regular/Medium/Bold/Black 已自托管；数字/终端使用 Space Grotesk / JetBrains Mono 等宽栈。
