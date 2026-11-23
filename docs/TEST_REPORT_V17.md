# TRISOLARIS v1.7 测试与验收

- tsc --noEmit：0 错误
- Vitest：17 个测试文件 / 247 用例全部通过
- Vite build：成功（124 modules）
- 浏览器 QA：
  - 新游戏 HUD：星历 0 年
  - 事件触发/待决：不显示暂停遮罩（即使 state.paused=true），右侧事件抽屉显示范围
  - 点击选择/提交：paused=false，抽屉关闭，无暂停页
  - 编年史：星历 1 年（整数，无浮点尾巴）
  - 30 秒报告：实际 before→after 正常弹出
- 截图：artifacts/v17-01-newgame.png、v17-02-event-while-paused.png、v17-03-after-choice.png、v17-04-report.png
- 字体：HarmonyOS Sans SC Regular/Medium/Bold/Black 已自托管；数字/终端使用 Space Grotesk / JetBrains Mono 等宽栈。
