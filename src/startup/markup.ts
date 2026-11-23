/**
 * 启动动画的静态 DOM 模板（v1.4 · src/startup 私有模块）。
 *
 * 这里只有静态结构，没有任何插值或用户输入；动态内容（观测者代号、自检行、
 * 数字读数）由 index.ts 用 textContent 写入，避免 HTML 注入。
 */
export const STARTUP_MARKUP = `
<canvas class="su-bg" aria-hidden="true"></canvas>
<div class="su-black" data-su="black" aria-hidden="false">
  <div class="su-brandline">
    <span class="su-mark-slot">
      <img class="su-mark" alt="" />
      <span class="su-mark-fallback" aria-hidden="true">ECC</span>
    </span>
    <div class="su-brand-copy">
      <b>三体纪元 · TRISOLARIS</b>
      <span>CIVILIZATION ARCHIVE / 文明档案</span>
    </div>
    <span class="su-brand-build">V1.7 · CONTINUITY PROTOCOL</span>
  </div>

  <div class="su-emblem-slot">
    <img class="su-emblem" alt="三体纪元存续理事会徽章 · 三颗银色天体与开启的轨道" />
    <img class="su-reticle-asset" alt="" aria-hidden="true" />
  </div>

  <div class="su-intro">
    <h1 class="su-zh">纪元存续理事会</h1>
    <div class="su-en" data-typing>
      <span class="su-typed"></span><span class="su-caret" aria-hidden="true"></span>
    </div>
    <div class="su-tag">观测 · 守护 · 存续</div>
  </div>

  <div class="su-welcome">
    <h1 class="su-zh su-zh-welcome">欢迎，观测者</h1>
    <div class="su-en su-en-welcome" data-typing>
      <span class="su-typed"></span><span class="su-caret" aria-hidden="true"></span>
    </div>
    <p class="su-welcome-line">三颗太阳仍在舞蹈，理事会与你同在。</p>
    <p class="su-welcome-hint">按 <kbd>Enter</kbd> / 点击进入游戏 <span>ENTER / CLICK TO CONTINUE</span></p>
  </div>

  <button type="button" class="su-cta" data-su-advance>
    <span class="su-cta-copy su-cta-intro">开始观测 <em>BEGIN OBSERVATION</em></span>
    <span class="su-cta-copy su-cta-welcome">进入游戏 <em>ENTER / CLICK</em></span>
  </button>

  <div class="su-black-foot">
    <span>EPOCH CONTINUITY COUNCIL</span>
    <span class="su-act">ACT 01 / 06 · 黑幕 / BLACK</span>
    <span>观测 · 守护 · 存续</span>
  </div>
</div>

<div class="su-paper" data-su="paper" aria-hidden="true">
  <div class="su-paper-dots" aria-hidden="true"></div>
  <header class="su-paper-head">
    <div class="su-paper-brand">
      <span class="su-mark-slot">
        <img class="su-mark su-mark-paper" alt="" />
        <span class="su-mark-fallback" aria-hidden="true">ECC</span>
      </span>
      <div class="su-brand-copy">
        <b>三体纪元 · TRISOLARIS</b>
        <span>CIVILIZATION ARCHIVE / 文明档案</span>
      </div>
    </div>
    <div class="su-paper-file">
      <span>FILE · TRS-EC-0042</span>
      <span>密级 · 存续 / CONTINUITY</span>
    </div>
  </header>

  <main class="su-paper-main">
    <section class="su-doc">
      <div class="su-doc-overline">// CIVILIZATION CONTINUITY PROTOCOL · 05</div>
      <h2 class="su-doc-title">文明存续授权</h2>
      <div class="su-doc-en">CIVILIZATION CONTINUITY PROTOCOL</div>
      <dl class="su-meta">
        <div><dt>档案编号 / FILE ID</dt><dd>TRS-EC-0042</dd></div>
        <div><dt>建档时间 / ISSUED</dt><dd>0000.03.17 · 04:22</dd></div>
        <div><dt>观测站 / STATION</dt><dd>马蹄星观测站 · HORSESHOE</dd></div>
        <div><dt>授权状态 / STATUS</dt><dd class="su-status-value">待授权 / PENDING</dd></div>
      </dl>
      <figure class="su-orbit-figure">
        <canvas class="su-orbit" aria-label="三体轨道示意图"></canvas>
        <figcaption>
          <span>三体轨道示意图 / THREE-BODY ORBIT SCHEMATIC</span>
          <span>SCALE 1 : 1.4×10¹¹ m</span>
        </figcaption>
      </figure>
      <div class="su-selfcheck">
        <div class="su-selfcheck-head">
          <span>启动自检 / BOOT SELF-CHECK</span>
          <span class="su-selfcheck-pct">00 / 06</span>
        </div>
        <ul class="su-log"></ul>
      </div>
    </section>

    <section class="su-console">
      <div class="su-console-head">
        <span class="su-console-title">存续授权序列 / CLEARANCE SEQUENCE</span>
        <span class="su-console-count">01 / 05</span>
      </div>
      <ol class="su-slats">
        <li><span class="su-slat-num">Ⅰ</span><span class="su-slat-label">观测权限</span></li>
        <li><span class="su-slat-num">Ⅱ</span><span class="su-slat-label">档案确认</span></li>
        <li><span class="su-slat-num">Ⅲ</span><span class="su-slat-label">轨道载入</span></li>
        <li><span class="su-slat-num">Ⅳ</span><span class="su-slat-label">模型校验</span></li>
        <li><span class="su-slat-num">Ⅴ</span><span class="su-slat-label">授权通过</span></li>
      </ol>

      <div class="su-panels">
        <article class="su-panel" data-step="1" aria-hidden="true">
          <div class="su-step-eyebrow">STEP 01 / 05 · 权限申请</div>
          <h3 class="su-step-title">观测权限申请</h3>
          <div class="su-step-en">OBSERVATION ACCESS REQUEST</div>
          <p class="su-step-desc">为继续执行文明存续协议，理事会请求授予对本星系的正式观测权限。授权后，你将作为观测者记录三颗太阳的每一次舞蹈。</p>
          <div class="su-step-actions">
            <button type="button" class="su-btn su-btn-primary" data-su-advance>授予观测权限 <span>GRANT OBSERVATION ACCESS</span></button>
          </div>
          <div class="su-step-hint"><kbd>ENTER</kbd> / <kbd>SPACE</kbd> 继续 · 移动端点击按钮</div>
        </article>

        <article class="su-panel" data-step="2" aria-hidden="true">
          <div class="su-step-eyebrow">STEP 02 / 05 · 档案确认</div>
          <h3 class="su-step-title">观测者档案确认</h3>
          <div class="su-step-en">OBSERVER IDENTITY VERIFICATION</div>
          <dl class="su-idcard">
            <div><dt>观测者代号 / OBSERVER</dt><dd class="su-observer-name">OBSERVER-01</dd></div>
            <div><dt>权限级别 / CLEARANCE</dt><dd>存续观测 / CONTINUITY OBSERVATION</dd></div>
            <div><dt>档案编号 / FILE ID</dt><dd>ECC-0731-Δ</dd></div>
            <div><dt>授权范围 / SCOPE</dt><dd>三体星系 / TRISOLARIS SYSTEM</dd></div>
          </dl>
          <div class="su-step-actions">
            <button type="button" class="su-btn su-btn-primary" data-su-advance>确认档案 <span>CONFIRM IDENTITY</span></button>
          </div>
          <div class="su-step-hint"><kbd>ENTER</kbd> / <kbd>SPACE</kbd> 继续 · 档案由理事会档案库签发</div>
        </article>

        <article class="su-panel" data-step="3" aria-hidden="true">
          <div class="su-step-eyebrow">STEP 03 / 05 · 轨道载入</div>
          <h3 class="su-step-title">三体轨道载入</h3>
          <div class="su-step-en">THREE-BODY ORBIT LOAD</div>
          <p class="su-step-desc">载入三颗恒星的历史轨迹与实时位置。轨道解在本地求解，不做任何外部通信。</p>
          <ul class="su-rows">
            <li class="su-row"><span class="su-row-label">恒星 A / STAR A</span><span class="su-row-leader"></span><span class="su-row-state">载入中</span></li>
            <li class="su-row"><span class="su-row-label">恒星 B / STAR B</span><span class="su-row-leader"></span><span class="su-row-state">载入中</span></li>
            <li class="su-row"><span class="su-row-label">恒星 C / STAR C</span><span class="su-row-leader"></span><span class="su-row-state">载入中</span></li>
          </ul>
          <div class="su-progress"><i class="su-progress-bar"></i></div>
          <div class="su-progress-row"><span class="su-progress-label">ORBIT SOLVE</span><span class="su-progress-num">000%</span></div>
        </article>

        <article class="su-panel" data-step="4" aria-hidden="true">
          <div class="su-step-eyebrow">STEP 04 / 05 · 模型校验</div>
          <h3 class="su-step-title">预测模型校验</h3>
          <div class="su-step-en">PREDICTION MODEL VERIFY</div>
          <p class="su-step-desc">以历史观测数据回测三体预测模型，收敛后即可签发存续授权。</p>
          <ul class="su-rows">
            <li class="su-row"><span class="su-row-label">星历残差 / EPHEMERIS RESIDUAL</span><span class="su-row-leader"></span><b class="su-row-value" data-from="0.9137" data-to="0.0042" data-digits="4" data-suffix=" AU">0.9137 AU</b><span class="su-row-state">校验中</span></li>
            <li class="su-row"><span class="su-row-label">李雅普诺夫指数 / LYAPUNOV</span><span class="su-row-leader"></span><b class="su-row-value" data-from="1.742" data-to="0.913" data-digits="3" data-suffix="">1.742</b><span class="su-row-state">校验中</span></li>
            <li class="su-row"><span class="su-row-label">预测置信度 / CONFIDENCE</span><span class="su-row-leader"></span><b class="su-row-value" data-from="41.8" data-to="99.7" data-digits="1" data-suffix="%">41.8%</b><span class="su-row-state">校验中</span></li>
            <li class="su-row"><span class="su-row-label">混沌漂移 / CHAOS DRIFT</span><span class="su-row-leader"></span><b class="su-row-value" data-from="0.8841" data-to="0.0003" data-digits="4" data-suffix="">0.8841</b><span class="su-row-state">校验中</span></li>
          </ul>
          <div class="su-progress"><i class="su-progress-bar"></i></div>
          <div class="su-progress-row"><span class="su-progress-label">MODEL VERIFY</span><span class="su-progress-num">000%</span></div>
        </article>

        <article class="su-panel" data-step="5" aria-hidden="true">
          <div class="su-step-eyebrow">STEP 05 / 05 · 授权通过</div>
          <h3 class="su-step-title">存续授权通过</h3>
          <div class="su-step-en">CONTINUITY CLEARANCE GRANTED</div>
          <div class="su-clearance">
            <span class="su-clearance-mark" aria-hidden="true">✓</span>
            <span class="su-clearance-copy">CLEARANCE GRANTED<small>观测权限已授予 · 理事会与你同在</small></span>
          </div>
          <ul class="su-rows su-grant-rows">
            <li class="su-row"><span class="su-row-label">观测权限 / OBSERVATION ACCESS</span><span class="su-row-leader"></span><span class="su-row-state">GRANTED</span></li>
            <li class="su-row"><span class="su-row-label">文明档案 / CIVILIZATION ARCHIVE</span><span class="su-row-leader"></span><span class="su-row-state">UNSEALED</span></li>
            <li class="su-row"><span class="su-row-label">存续协议 / CONTINUITY PROTOCOL</span><span class="su-row-leader"></span><span class="su-row-state">ACTIVE</span></li>
          </ul>
        </article>
      </div>

      <div class="su-console-foot">
        <span class="su-console-hint"><kbd>ENTER</kbd> / <kbd>SPACE</kbd> 继续 · <kbd>ESC</kbd> 跳过</span>
        <span class="su-console-sig">ECC · CONTINUITY</span>
      </div>
    </section>
  </main>

  <footer class="su-paper-foot">
    <span>EPOCH CONTINUITY COUNCIL</span>
    <span>观测 / OBSERVE · 守护 / PRESERVE · 存续 / CONTINUE</span>
    <span class="su-page-no">03 / 06</span>
  </footer>
</div>

<canvas class="su-fx" aria-hidden="true"></canvas>
<button type="button" class="su-skip">SKIP <span>跳过</span> <kbd>ESC</kbd></button>
<p class="su-live" aria-live="polite"></p>
`;
