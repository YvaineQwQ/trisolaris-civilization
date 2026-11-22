# TRISOLARIS v1.6.0 · 发布说明

日期：2026-11-23  
版本：1.6.0  
仓库：https://github.com/YvaineQwQ/trisolaris-civilization  
本地：http://127.0.0.1:8080/

## 交付内容

1. **科技 / 六时代**
   - E1 原始 → E2 城邦 → E3 蒸汽 → E4 电气 → E5 信息与早期航天 → E6 星际。
   - 192 项科技，9 分支（新增社会科学），7 组互斥教义；发展纲领（1–2 个大类）、科研倾斜 0–100%、注入资源加速、科学院 5 级建筑群。
   - 科技树 SVG 连线图，支持分支/时代/学说筛选、缩放、滚动与详情；修正空间站/计算机/电力等时代倒挂。
2. **事件**
   - 64 事件逻辑审计；选择前只显示区间，实际值由历史/难度/seed 决定的区间内随机产生，30 秒报告显示实际 before→after。
   - 非阻塞右侧事件抽屉；304px 编年史侧栏（事件/居民死亡/灾害/里程碑分级）；底栏只保留事件摘要。
3. **视觉**
   - 启动徽章去字、替换图二箭头/轨道弧线、透明化并接入 PV / favicon / 品牌标。
   - 自托管 Archivo / Outfit / Space Grotesk / JetBrains Mono；四种字体角色；四类形状语义（直角/切角/圆与弧/胶囊）；零偏移阴影。
4. **移动端**
   - 390×844 / 844×390 无横向溢出；编年史侧栏在 ≤1180px 隐藏，保留既有「决策 → 事件」页签。

## 验证

- tsc：0 错误
- Vitest：17 文件 / 247 用例通过
- Vite build：通过
- 浏览器 QA：0 exception / 0 console error / 0 failed request（事件抽屉、报告、科技树、启动 PV、响应式）
- 证据截图见 `artifacts/ev16-*.png`、`v16-*.png`、`resp2-*.png`。

## 包

- `release/TRISOLARIS-v1.6-source.zip`：完整源码 + 资源 + 测试 + 文档（约 50.5MB）
- `release/TRISOLARIS-v1.6-web.zip`：已构建静态站（约 49.8MB）
- 解压源码后：`npm install` → `npm run build` → `npm run preview`；开发：`npm run dev`。

## 已知限制

- 科技为 192 项（每大类 ≥20、六时代分布），不是字面 1080 项（每时代每大类 20）；原因是可玩性与 UI 可维护性，详见 `docs/TECH_TREE_V6.md`。
- 编年史宽侧栏仅桌面；平板/手机用右栏事件页签。
- E6 经济系统沿用 E5 的 `economy.ts` 时代夹取；殖民/行星发动机门禁已强制。
- 无头 QA 的 rAF 被浏览器节流，30 秒窗口通过受控 `elapsedRealSeconds` 验证；核心计时另有单元测试。
- 事件历史对区间的方向性偏移是“整体更温和/更不利”的对称语义；尚未按正负效果分别反转。
