# TRISOLARIS v1.6 测试与验收报告

日期：2026-11-23  
环境：Windows 11 / Node v26.13.1 / TypeScript 5 strict / Vitest 2.1.9 / Vite 6.4.6  
项目：`C:\\Users\\hp000001\\Downloads\\three-body-civilization`  
浏览器：Microsoft Edge headless（CDP），1600×900 / 1280×720 / 844×390 / 390×844。

## 1. 结论

| 项目 | 结果 |
| --- | --- |
| `tsc --noEmit` | **0 错误** |
| `vitest run` | **17 个测试文件 / 247 个用例全部通过** |
| `vite build` | **成功**（124 modules；主包 954KB / gzip 329KB；3D 独立 chunk 581KB） |
| 浏览器异常 | 0 page exception / 0 console error / 0 failed request（事件抽屉与科技树 QA 场景） |
| 移动端 | 390×844 无横向溢出；横屏 844×390 无横向溢出 |
| 桌面 | 1600×900、1280×720 布局正常；编年史 304px 侧栏 + 右侧 46px 决策窄条 |

## 2. 新增/关键测试

- `tests/systems/tech-v6.test.ts`（8）：192 项科技、9 分支、6 时代完整性；id 唯一；前置同支且 tier 更低；每支每代≥2；互斥组；发展纲领速度；科研倾斜；注入加速；科学院链；时代推进。
- `tests/systems/event-ranges.test.ts`（21）：区间上下界、history 修正、难度放宽、确定性随机、实际值落在区间、同 seed 可复现、事件逻辑审计。
- `tests/systems/events.test.ts`（31）：v1.5 节奏/30 秒延迟被保留；选择前区间包含实际结算；报告 delta 与落地一致（0.01 舍入）。
- 既有物理/生成/环境/观测/经济/建筑/政治/存档/完整循环测试全部通过。

## 3. 浏览器 QA（真实运行）

场景：
1. 启动 / 游戏默认界面：编年史 304px、HUD 摘要、46px 决策窄条、底栏事件摘要。
2. 强制触发 `env_red_dawn`：右侧非阻塞抽屉显示 3 个选项；区间文本示例：
   - 食物 −113 ~ −188 吨
   - 稳定度 +3 ~ +5 点
   - 后续事件「酷热」权重 ×1.6
3. 选择「躲进地窖」→ 提交：抽屉关闭，模拟继续；编年史与底栏摘要出现选择记录。
4. 直接推进 `meta.elapsedRealSeconds += 31` 并更新：30 秒报告弹出，显示实际食物 −118 吨、稳定度 +4.5 点；确认按钮可继续。
5. 科技树：9 分支 × 6 时代 × 192 项，SVG 连线、筛选、发展纲领、资源倾斜 50%、注入加速按钮均可见。
6. 移动/横屏：390×844、844×390 无横向溢出；编年史宽侧栏在 ≤1180px 隐藏，保留既有「决策 → 事件」页签。

截图（artifacts）：
- `ev16-00-default.png` 默认游戏 + 编年史
- `ev16-10-event-drawer.png` 非阻塞事件抽屉 + 区间
- `ev16-12-event-report.png` 30 秒实际结算报告
- `v16-03-tech-tree.png` 科技树
- `v16-startup.png` 新徽章启动 PV
- `resp-mobile.png` / `resp-landscape.png` / `resp-desktop1280.png` 响应式

## 4. 已知限制

- 无头浏览器 rAF 被节流，正常 QA 中 4× 速度 26 秒仅推进数回合；事件触发/30 秒窗口在 QA 中用受控 `state.events.pending` 与 `elapsedRealSeconds` 推进验证，核心单元测试仍覆盖真实计时逻辑。
- 编年史宽侧栏只在 >1180px 显示；移动端用右侧「事件」页签，这是刻意避免浮层压住中央观测。
- 科技树 192 项、9 分支，每支 ≥20 项、每时代每支 ≥2 项；未做到“每时代每大类 20 项”的 1080 项规模，具体取舍见 `docs/TECH_TREE_V6.md`。
- `economy.ts` 的时代夹取仍为 5（E6 经济效率等同 E5），属于现有系统边界；