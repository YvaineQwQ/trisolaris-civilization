# TRISOLARIS v1.7.0 发布说明

日期：2026-11-23
版本：1.7.0
GitHub：https://github.com/YvaineQwQ/trisolaris-civilization
本地：http://127.0.0.1:8080/

## 本次修复

1. 徽章替换为用户提供的白色三球/纸飞机图，去除右下角水印，透明化适配启动 PV、favicon、品牌小标。
2. 修复事件选择：事件触发不再自动暂停；待决期间不显示暂停遮罩；点击抉择后模拟继续运行，30 秒照常送达实际结算报告。
3. 星历从 0 年开始（新游戏）；编年史/事件摘要/底栏年份取整，不再出现浮点小数。
4. 字体：内置 HarmonyOS Sans SC 四档（Regular 400 / Medium 500 / Bold 700 / Black 900），中文主标题/正文/UI 标签按该层级；数字与终端读数使用等宽字体。
5. 上一版的编年史、非阻塞事件抽屉、192 项科技树、六时代、设计系统保留。

## 验证

- tsc：0 错误
- Vitest：17 文件 / 247 用例全部通过
- Vite build：成功
- 浏览器 QA：新游戏星历 0 年；强制待决事件在暂停态下不显示暂停遮罩，点击抉择后暂停解除；编年史显示“星历 1 年”整数；30 秒报告正常。
- 事件 QA：artifacts/v17-02-event-while-paused.png、artifacts/v17-03-after-choice.png
- 新徽章原图：public/startup/council-emblem-v7.png

## 包 / 部署

- release/TRISOLARIS-v1.7-source.zip
- release/TRISOLARIS-v1.7-web.zip
- Netlify Drop 临时站（1 小时内有效，需登录 Claim this site 认领）：https://calm-syrniki-f12d03.netlify.app
