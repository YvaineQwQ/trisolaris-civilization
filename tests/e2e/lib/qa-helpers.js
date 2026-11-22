/* Page-side helpers for the TRISOLARIS acceptance suite.
 * Injected with Page.addScriptToEvaluateOnNewDocument before any page script.
 * Plain ES2017 (no template literals) so it can be embedded anywhere.
 */
(function () {
  "use strict";
  window.__QA_ERRORS__ = [];
  window.addEventListener("error", function (e) {
    window.__QA_ERRORS__.push("error: " + ((e && (e.message || e.type)) || "unknown"));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    window.__QA_ERRORS__.push("rejection: " + ((r && r.message) || String(r)));
  });

  function api() { return (window.__TRISOLARIS__ && window.__TRISOLARIS__.app) || null; }
  function game() { var a = api(); return a ? a.activeGame() : null; }
  function mustGame() { var g = game(); if (!g) throw new Error("no active game"); return g; }
  function vec3(v) { return v ? [v.x, v.y, v.z] : null; }
  function flt(x, n) { return typeof x === "number" && isFinite(x) ? Number(x.toFixed(n == null ? 6 : n)) : x; }
  function dist3(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
  function round(x, n) { var p = Math.pow(10, n == null ? 6 : n); return Math.round(x * p) / p; }

  function fp() {
    var g = game();
    if (!g) return null;
    var s = g.state;
    var resources = {};
    for (var id in s.civ.resources) resources[id] = round(s.civ.resources[id].amount, 3);
    return {
      seed: s.meta.seed, difficulty: s.meta.difficulty, mode: s.meta.mode,
      years: s.yearsElapsed, physicsYears: s.physics.timeYears,
      turn: s.civ.turn, population: s.civ.population, gameOver: !!s.gameOver, victory: !!s.victory,
      paused: !!g.pausedValue, speed: g.speedValue, selection: g.selection,
      obsLevel: s.observation.level,
      resources: resources,
      tech: s.tech.researched.slice(),
      buildings: Object.assign({}, s.buildings.counts),
      queue: s.buildings.queue.map(function (q) { return { id: q.id, buildingId: q.buildingId, turnsLeft: q.turnsLeft }; }),
      stars: s.physics.stars.map(function (st) {
        return { id: st.id, pos: vec3(st.pos), vel: vec3(st.vel), mass: round(st.mass, 6) };
      }),
      planet: { pos: vec3(s.physics.planet.pos), alive: !!s.physics.planetAlive },
      diagnostics: {
        energyDrift: s.physics.diagnostics.energyDrift,
        totalEnergy: s.physics.diagnostics.totalEnergy,
        totalMomentum: vec3(s.physics.diagnostics.totalMomentum),
        steps: s.physics.diagnostics.steps,
        overflow: !!s.physics.diagnostics.overflow,
      },
      ending: s.gameOver ? { title: s.endingTitle, victory: !!s.victory } : null,
      logCount: s.log ? s.log.length : 0,
    };
  }

  function layout() {
    var doc = document.documentElement;
    var body = document.body;
    function rect(sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
    }
    var hud = rect(".tri-hud");
    var dock = rect(".tri-dock");
    var left = rect(".tri-panel-left");
    var right = rect(".tri-panel-right");
    var center = rect(".tri-center");
    var canvas = rect("#scene-canvas");
    var overflowX = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0) > window.innerWidth + 1;
    var overflowY = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0) > window.innerHeight + 1;
    function inside(r) { return !!r && r.x >= -2 && r.y >= -2 && r.right <= window.innerWidth + 2 && r.bottom <= window.innerHeight + 2; }
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight, dpr: window.devicePixelRatio,
      scrollWidth: Math.max(doc.scrollWidth, body ? body.scrollWidth : 0),
      scrollHeight: Math.max(doc.scrollHeight, body ? body.scrollHeight : 0),
      overflowX: overflowX, overflowY: overflowY,
      hud: hud, dock: dock, left: left, right: right, center: center, canvas: canvas,
      hudInside: inside(hud), dockInside: inside(dock), leftInside: inside(left), rightInside: inside(right),
      screen: (document.querySelector(".tri-screen") || {}).className || null,
      viewMode: (function () {
        var m = document.querySelector(".tri-viewmode-btn.is-active");
        return m ? (m.textContent || "").trim() : null;
      })(),
    };
  }

  function viewSnap() {
    var g = game();
    if (!g) return null;
    var v = g.view();
    var obs = v.observation;
    return {
      meta: {
        seed: v.meta.seed, difficultyKey: v.meta.difficultyKey, mode: v.meta.mode,
        galaxyClassName: v.meta.galaxyClassName, year: v.meta.year, turn: v.meta.turn, era: v.meta.era,
        paused: v.meta.paused, speedValue: v.meta.speedValue, running: v.meta.running,
        gameOver: v.meta.gameOver, endingTitle: v.meta.endingTitle,
      },
      population: v.civ.population.total,
      stability: v.civ.stability.value,
      science: { activeTechId: v.civ.science.activeTechId, activeTechName: v.civ.science.activeTechName, percent: v.civ.science.percent },
      resources: v.resources.map(function (r) { return { id: r.id, amount: round(r.amount, 3), net: round(r.net, 3) }; }),
      observatory: { level: v.observatory.level, maxLevel: v.observatory.maxLevel, nextCanUpgrade: v.observatory.next ? v.observatory.next.canUpgrade : false, nextBlocked: v.observatory.next ? v.observatory.next.blockedReason : null },
      observation: {
        stars: obs.stars.map(function (s) {
          return {
            id: s.id, known: s.known, pos: s.pos, height: round(s.height, 6),
            distance: s.distance, mass: s.mass, speed: s.speed,
            sigmaPos: s.sigmaPos, sigmaVel: s.sigmaVel, confidence: s.confidence,
            inclination: s.inclination, sampleCount: s.sampleCount,
          };
        }),
        planet: obs.planet ? { pos: obs.planet.pos, height: round(obs.planet.height, 6), sigmaPos: obs.planet.sigmaPos, known: obs.planet.known } : null,
        activeTask: obs.activeTask ? { kind: obs.activeTask.kind, progress: obs.activeTask.progress, turnsElapsed: obs.activeTask.turnsElapsed, turnsRequired: obs.activeTask.turnsRequired } : null,
        taskOptions: obs.taskOptions.map(function (o) { return { kind: o.kind, enabled: o.enabled, targetMode: o.targetMode, energyCost: o.energyCost }; }),
        discoveries: obs.discoveries.length, dataPoints: obs.dataPoints,
        hasModel: obs.hasModel, modelAccuracy: obs.modelAccuracy, modelHorizon: obs.modelHorizon, modelNote: obs.modelNote,
        observedTrailAvailable: obs.observedTrailAvailable,
      },
      prediction: { available: v.prediction.available, reason: v.prediction.reason, horizonYears: v.prediction.horizonYears, reliableYears: v.prediction.reliableYears, diverged: v.prediction.diverged, createdYear: v.prediction.createdYear, stars: v.prediction.stars.map(function (p) { return { id: p.id, reliableYears: p.reliableYears, endpoint: p.endpoint, closestApproachAU: p.closestApproachAU }; }) },
      buildings: { available: v.buildings.available.length, built: v.buildings.built.map(function (b) { return { id: b.id, count: b.count }; }), queue: v.buildings.queue.length },
      tech: { branches: v.tech.branches.map(function (b) { return { id: b.id, researched: b.researchedCount, total: b.total }; }) },
      selection: v.selection,
      settings: v.settings,
      alerts: v.alerts.map(function (a) { return a.title; }),
      logCount: v.log.length,
    };
  }

  function obsSnap() {
    var g = game();
    if (!g) return null;
    var o = g.state.observation;
    var out = { level: o.level, equipmentLevel: o.equipmentLevel, efficiency: o.efficiency, dataPoints: o.dataPoints, stars: {}, planet: null };
    ["A", "B", "C"].forEach(function (id) {
      var s = o.stars[id];
      out.stars[id] = {
        known: s.known, pos: vec3(s.pos), vel: vec3(s.vel), mass: round(s.mass, 6),
        sigmaPos: s.sigmaPos, sigmaVel: s.sigmaVel, sigmaMass: s.sigmaMass,
        confidence: s.confidence, sampleCount: s.sampleCount, lastMeasuredYear: s.lastMeasuredYear,
        height: s.height, speed: s.speed, inclinationRad: s.inclinationRad,
        distanceFromBarycenter: s.distanceFromBarycenter,
      };
    });
    if (o.planet) out.planet = { pos: vec3(o.planet.pos), height: o.planet.height, sigmaPos: o.planet.sigmaPos, known: o.planet.known, confidence: o.planet.confidence };
    out.activeTask = o.activeTask ? { kind: o.activeTask.kind, target: o.activeTask.target, turnsElapsed: o.activeTask.turnsElapsed, turnsRequired: o.activeTask.turnsRequired, samplesCollected: o.activeTask.samplesCollected } : null;
    out.measurementCount = o.measurements.stars.length;
    out.historyCount = o.history.length;
    out.discoveries = o.discoveries.map(function (d) { return d.title; });
    out.observedTrailPoints = Object.keys(o.observedTrail).map(function (k) { return o.observedTrail[k].length; });
    out.planetObservedTrailPoints = o.planetObservedTrail.length;
    out.model = o.playerModel ? { valid: !!o.playerModel.valid, accuracy: o.playerModel.accuracy, horizonYears: o.playerModel.horizonYears, createdYear: o.playerModel.createdYear, note: o.playerModel.note } : null;
    out.prediction = o.prediction ? { createdYear: o.prediction.createdYear, horizonYears: o.prediction.horizonYears, reliableFraction: o.prediction.reliableFraction, diverged: !!o.prediction.diverged, samples: o.prediction.samples.length } : null;
    return out;
  }

  /** Compare player estimates against the true physics state (knowledge-boundary checks). */
  function truthError() {
    var g = game();
    if (!g) return null;
    var s = g.state;
    var out = { stars: {}, planet: null };
    ["A", "B", "C"].forEach(function (id) {
      var truth = s.physics.stars.filter(function (x) { return x.id === id; })[0];
      var est = s.observation.stars[id];
      var diff = dist3(vec3(truth.pos), vec3(est.pos));
      out.stars[id] = {
        known: est.known, truthPos: vec3(truth.pos), estPos: vec3(est.pos),
        posError: diff, sigmaPos: est.sigmaPos, sampleCount: est.sampleCount,
        errorOverSigma: est.sigmaPos > 0 ? diff / est.sigmaPos : null,
      };
    });
    var p = s.observation.planet;
    if (p) {
      out.planet = { truthPos: vec3(s.physics.planet.pos), estPos: vec3(p.pos), posError: dist3(vec3(s.physics.planet.pos), vec3(p.pos)), sigmaPos: p.sigmaPos };
    }
    return out;
  }

  /** 2D scene vs 3D scene: same source coordinates (call while paused for exact equality). */
  function sceneCompare() {
    var g = game();
    if (!g) return null;
    var a = g.scene();
    var b = g.scene3d();
    var starRows = [];
    var maxDiff = 0;
    for (var i = 0; i < Math.max(a.stars.length, b.stars.length); i += 1) {
      var x = a.stars[i], y = b.stars[i];
      var d = x && y ? Math.max(Math.abs(x.pos.x - y.pos.x), Math.abs(x.pos.y - y.pos.y), Math.abs(x.pos.z - y.pos.z)) : null;
      if (d != null && d > maxDiff) maxDiff = d;
      starRows.push({ id: x ? x.id : null, id3: y ? y.id : null, sameId: !!x && !!y && x.id === y.id, maxDiff: d });
    }
    var planetDiff = a.planet && b.planet
      ? Math.max(Math.abs(a.planet.pos.x - b.planet.pos.x), Math.abs(a.planet.pos.y - b.planet.pos.y), Math.abs(a.planet.pos.z - b.planet.pos.z))
      : null;
    return {
      seed2d: a.seed, seed3d: b.seed, time2d: a.timeYears, time3d: b.timeYears,
      stars: starRows, starCount2d: a.stars.length, starCount3d: b.stars.length, maxStarDiff: maxDiff, planetDiff: planetDiff,
      planetCount2d: a.planet ? 1 : 0, planetCount3d: b.planet ? 1 : 0,
      selection2d: a.selection, selection3d: b.selection,
      heightDataAvailable: b.heightDataAvailable,
      observedTrails2d: a.observedTrails.length, observedTrails3d: b.observedTrails.length,
      predictedTrails2d: a.predictedTrails.length, predictedTrails3d: b.predictedTrails.length,
      uncertaintyClouds: b.uncertaintyClouds.length, uncertaintyRings: a.uncertaintyRings.length,
      hasColony2d: a.hasColony, hasColony3d: b.hasColony,
      statusLabel3d: b.statusLabel,
    };
  }

  /** Replay k fixed physics steps from a snapshot and compare against the live state. */
  async function replay(k, snap) {
    var mod = await import("/src/physics/nbody.ts");
    var g = mustGame();
    var clone = JSON.parse(JSON.stringify(snap));
    var t0 = performance.now();
    for (var i = 0; i < k; i += 1) mod.stepPhysics(clone);
    var ms = performance.now() - t0;
    var live = g.state.physics;
    var maxPos = 0, maxVel = 0;
    for (var j = 0; j < clone.stars.length; j += 1) {
      var a = clone.stars[j], b = live.stars[j];
      maxPos = Math.max(maxPos, Math.abs(a.pos.x - b.pos.x), Math.abs(a.pos.y - b.pos.y), Math.abs(a.pos.z - b.pos.z));
      maxVel = Math.max(maxVel, Math.abs(a.vel.x - b.vel.x), Math.abs(a.vel.y - b.vel.y), Math.abs(a.vel.z - b.vel.z));
    }
    return { k: k, maxPosDiff: maxPos, maxVelDiff: maxVel, replayMs: round(ms, 2), timeDiff: Math.abs(clone.timeYears - live.timeYears) };
  }

  async function conserved() {
    var mod = await import("/src/physics/nbody.ts");
    var q = mod.conservedQuantities(mustGame().state.physics);
    return { energy: q.energy, momentum: vec3(q.momentum), angularMomentum: vec3(q.angularMomentum) };
  }

  function physSnap() {
    var p = mustGame().state.physics;
    return {
      timeYears: p.timeYears, dtYears: p.dtYears, softening: p.softening,
      stars: p.stars.map(function (s) { return { id: s.id, pos: vec3(s.pos), vel: vec3(s.vel), mass: s.mass }; }),
      planet: { pos: vec3(p.planet.pos), vel: vec3(p.planet.vel), alive: !!p.planetAlive },
      diagnostics: { steps: p.diagnostics.steps, energyDrift: p.diagnostics.energyDrift, overflow: !!p.diagnostics.overflow },
    };
  }

  /** Deep JSON copy of the complete physics state (objects, not packed arrays) for exact step replay. */
  function physFull() {
    var g = mustGame();
    return JSON.parse(JSON.stringify(g.state.physics));
  }

  /** Frame-rate baseline that does not require an active game (for headless environment calibration). */
  function rafPerf(durationMs) {
    return new Promise(function (resolve) {
      var t0 = performance.now();
      var frames = 0;
      function loop(t) {
        frames += 1;
        if (t - t0 < durationMs) { requestAnimationFrame(loop); return; }
        resolve({ frames: frames, ms: round(t - t0, 1), fps: round(frames / ((t - t0) / 1000), 2) });
      }
      requestAnimationFrame(loop);
    });
  }

  /**
   * Deterministic accelerated long run driven by the production Game.update() API.
   * Used for numerical-stability acceptance independent of the (software-rendered) headless FPS.
   */
  function longRun(targetYears, stepRealSeconds) {
    var g = mustGame();
    g.setSpeedIndex(7);
    var dtReal = stepRealSeconds || 0.05;
    var startYear = g.state.yearsElapsed;
    var updates = 0;
    var t0 = performance.now();
    while (g.state.yearsElapsed - startYear < targetYears && updates < 200000 && !g.state.gameOver) {
      g.update(dtReal);
      updates += 1;
    }
    var ms = performance.now() - t0;
    g.setSpeedIndex(0);
    return {
      targetYears: targetYears,
      yearsDelta: round(g.state.yearsElapsed - startYear, 4),
      updates: updates,
      wallMs: round(ms, 2),
      simYearsPerWallSecond: round((g.state.yearsElapsed - startYear) / (ms / 1000), 2),
      gameOver: !!g.state.gameOver,
      endingTitle: g.state.endingTitle,
      diagnostics: {
        steps: g.state.physics.diagnostics.steps,
        energyDrift: g.state.physics.diagnostics.energyDrift,
        overflow: g.state.physics.diagnostics.overflow,
      },
    };
  }

  /** rAF frame counter + simulated-time throughput over a wall-clock window. */
  function perf(durationMs) {
    return new Promise(function (resolve) {
      var g = game();
      var t0 = performance.now();
      var frames = 0;
      var y0 = g ? g.state.yearsElapsed : null;
      var steps0 = g ? g.state.physics.diagnostics.steps : null;
      function loop(t) {
        frames += 1;
        if (t - t0 < durationMs) { requestAnimationFrame(loop); return; }
        var g2 = game();
        var elapsed = t - t0;
        resolve({
          frames: frames, ms: round(elapsed, 1), fps: round(frames / (elapsed / 1000), 1),
          yearsDelta: g2 && y0 != null ? round(g2.state.yearsElapsed - y0, 4) : null,
          physicsSteps: g2 && steps0 != null ? g2.state.physics.diagnostics.steps - steps0 : null,
          yearsPerSecond: g2 && y0 != null ? round((g2.state.yearsElapsed - y0) / (elapsed / 1000), 4) : null,
          speed: g2 ? g2.speedValue : null,
          viewMode: (function () { var m = document.querySelector(".tri-viewmode-btn.is-active"); return m ? (m.textContent || "").trim() : null; })(),
        });
      }
      requestAnimationFrame(loop);
    });
  }

  function canvasInfo(selector) {
    var c = document.querySelector(selector || "#scene-canvas");
    if (!c) return { exists: false };
    var info = { exists: true, width: c.width, height: c.height, cssW: Math.round(c.getBoundingClientRect().width), cssH: Math.round(c.getBoundingClientRect().height) };
    try { info.webgl2 = !!c.getContext("webgl2"); } catch (e) { info.webgl2 = false; }
    try { info.webgl = !!c.getContext("webgl"); } catch (e) { info.webgl = false; }
    return info;
  }

  /** Test-fixture injection; every mutation is recorded by the caller in the report. */
  function inject(opts) {
    var g = mustGame();
    var s = g.state;
    var changed = {};
    if (opts.resources) {
      for (var k in opts.resources) {
        if (s.civ.resources[k]) { s.civ.resources[k].amount = opts.resources[k]; changed[k] = opts.resources[k]; }
      }
    }
    if (opts.tech) {
      opts.tech.forEach(function (t) { if (s.tech.researched.indexOf(t) < 0) s.tech.researched.push(t); });
      changed.tech = s.tech.researched.slice();
    }
    if (opts.obsLevel != null) {
      s.observation.level = opts.obsLevel;
      s.observation.equipmentLevel = opts.obsLevel;
      s.observation.efficiency = 1 + (opts.obsLevel - 1) * 0.08;
      s.observation.modelDirty = true;
      changed.obsLevel = opts.obsLevel;
    }
    if (opts.population != null) { s.civ.population = opts.population; changed.population = opts.population; }
    return { changed: changed, fp: fp() };
  }

  function preview(seed, difficulty, mode) {
    var a = api();
    if (!a) return Promise.resolve(null);
    return a.previewGalaxy(seed, difficulty || "normal", mode || "normal").then(function (p) {
      return {
        seed: seed,
        classification: p.classification,
        planet: { name: p.planet.name, pos: vec3(p.planet.pos), orbitRadius: p.planet.orbitRadius, habitability: p.planet.habitability, initialTempC: p.planet.initialTempC },
        stars: p.stars.map(function (s) { return { id: s.id, pos: vec3(s.pos), vel: vec3(s.vel), mass: s.mass, luminosity: s.luminosity }; }),
        trajectoryPoints: Object.keys(p.trajectories).map(function (k) { return { id: k, n: p.trajectories[k].length }; }),
        warnings: p.warnings.slice(),
      };
    });
  }

  function newGame(seed, difficulty, mode) {
    var a = api();
    if (!a) return Promise.resolve(null);
    return a.createNewGame({ seed: seed, difficulty: difficulty || "normal", mode: mode || "normal" }).then(function () { return fp(); });
  }

  function listSaves() {
    var g = game();
    if (!g) return Promise.resolve([]);
    return g.actions.listSaves();
  }

  function importText(text) {
    var g = mustGame();
    return g.actions.importSaveText(text).then(function (ok) { return { ok: ok, fp: fp() }; });
  }

  /** Quick DOM audit of the visible game chrome (used by layout/flow checks). */
  function chrome() {
    function has(sel) { return document.querySelectorAll(sel).length; }
    return {
      screen: (document.querySelector(".tri-screen") || {}).className || null,
      hud: has(".tri-hud"), dock: has(".tri-dock"), left: has(".tri-panel-left"), right: has(".tri-panel-right"),
      viewmodeButtons: has(".tri-viewmode-btn"), speedButtons: has(".tri-speed-btn"),
      dockItems: Array.prototype.map.call(document.querySelectorAll("[data-dock]"), function (n) { return n.getAttribute("data-dock"); }),
      rightTabs: Array.prototype.map.call(document.querySelectorAll("[data-tab-right]"), function (n) { return n.getAttribute("data-tab-right"); }),
      leftTabs: Array.prototype.map.call(document.querySelectorAll("[data-tab]"), function (n) { return n.getAttribute("data-tab"); }),
      modalOpen: !!document.querySelector(".tri-modal-layer:not(.tri-hidden) .tri-modal"),
      pauseOverlay: !!document.querySelector(".tri-pause-overlay:not(.tri-hidden)"),
      toasts: Array.prototype.map.call(document.querySelectorAll(".tri-toast"), function (n) { return (n.textContent || "").trim().slice(0, 80); }),
      errorStrip: (function () { var e = document.querySelector(".tri-errorbar:not(.tri-hidden) .tri-errorbar-text"); return e ? (e.textContent || "").trim() : null; })(),
    };
  }

  /** Uncertainty magnitudes exposed by both scenes (knowledge-boundary visualisation). */
  function uncertaintySnap() {
    var g = game();
    if (!g) return null;
    var s2 = g.scene();
    var s3 = g.scene3d();
    function ringRadius(points) {
      if (!points || points.length === 0) return null;
      var cx = 0, cy = 0, cz = 0;
      for (var i = 0; i < points.length; i += 1) { cx += points[i].x; cy += points[i].y; cz += points[i].z; }
      cx /= points.length; cy /= points.length; cz /= points.length;
      var max = 0;
      for (var j = 0; j < points.length; j += 1) {
        var dx = points[j].x - cx, dy = points[j].y - cy, dz = points[j].z - cz;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > max) max = d;
      }
      return max;
    }
    return {
      time2d: s2.timeYears, time3d: s3.timeYears,
      stars2d: s2.stars.map(function (st) { return { id: st.id, sigmaAU: st.sigmaAU, confidence: st.confidence, known: st.known, mass: st.mass, tempK: st.tempK }; }),
      stars3d: s3.stars.map(function (st) { return { id: st.id, sigmaAU: st.sigmaAU, confidence: st.confidence, known: st.known, mass: st.mass }; }),
      rings2d: s2.uncertaintyRings.map(function (r) { return { id: r.id, radius: ringRadius(r.ring), alpha: r.alpha }; }),
      clouds3d: s3.uncertaintyClouds.map(function (c) { return { id: c.id, radiusAU: c.radiusAU, alpha: c.alpha }; }),
      observedTrails2d: s2.observedTrails.length, predictedTrails2d: s2.predictedTrails.length,
      observedTrails3d: s3.observedTrails.length, predictedTrails3d: s3.predictedTrails.length,
      predictedPlanetTrail2d: !!s2.predictedPlanetTrail, planetUncertainty2d: !!s2.planetUncertainty,
      heightDataAvailable: s3.heightDataAvailable,
      planet: s2.planet ? { pos: s2.planet.pos, sigmaAU: s2.planet.sigmaAU } : null,
    };
  }

  window.__QA = {
    api: api, game: game, state: function () { var g = game(); return g ? g.state : null; },
    view: function () { var g = game(); return g ? g.view() : null; },
    scene: function () { var g = game(); return g ? g.scene() : null; },
    scene3d: function () { var g = game(); return g ? g.scene3d() : null; },
    vec3: vec3, fp: fp, layout: layout, viewSnap: viewSnap, obsSnap: obsSnap, truthError: truthError,
    sceneCompare: sceneCompare, uncertaintySnap: uncertaintySnap, replay: replay, conserved: conserved, physSnap: physSnap, physFull: physFull, rafPerf: rafPerf, longRun: longRun,
    perf: perf, canvasInfo: canvasInfo, inject: inject, preview: preview, newGame: newGame,
    listSaves: listSaves, importText: importText, chrome: chrome,
    errors: function () { return window.__QA_ERRORS__.slice(); },
    clearErrors: function () { window.__QA_ERRORS__.length = 0; },
    visible: function (sel) { var el = document.querySelector(sel); if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; },
    count: function (sel) { return document.querySelectorAll(sel).length; },
    text: function (sel) { var el = document.querySelector(sel); return el ? (el.textContent || "").trim() : null; },
    bodyText: function () { return document.body.innerText || ""; },
  };
})();
