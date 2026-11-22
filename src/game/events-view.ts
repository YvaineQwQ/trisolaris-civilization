/**
 * EventsView assembly (v1.5): quantified choices + 30s delayed outcome report.
 */
import type { EventEffectForecast, EventState, GameState } from "../core/types";
import {
  EVENT_CATEGORY_NAMES, eventModifiersView, forecastEventEffects, getActiveEvent, isChoiceAvailable,
} from "../events";
import { forecastEffectBands } from "../events/outcome-ranges";
import type {
  ActiveEventView, EventEffectView, EventHistoryView, EventOutcomeView, EventsView,
} from "./viewTypes";

function effectView(effect: EventEffectForecast): EventEffectView {
  return {
    key: effect.key,
    label: effect.label,
    kind: effect.kind,
    before: effect.before,
    after: effect.after,
    delta: effect.delta,
    unit: effect.unit,
    tone: effect.tone,
    detail: effect.detail,
  };
}

/** 选择前只给区间；后端的 band 已把 cap 与夹取算进去。 */
function bandView(band: import("../events/outcome-ranges").EffectBand): EventEffectView {
  const center = band.deltaMin != null && band.deltaMax != null
    ? (band.deltaMin + band.deltaMax) / 2
    : null;
  return {
    key: band.key,
    label: band.label,
    kind: band.kind,
    before: band.before,
    after: band.afterMax,
    delta: center,
    minDelta: band.deltaMin,
    maxDelta: band.deltaMax,
    minAfter: band.afterMin,
    maxAfter: band.afterMax,
    unit: band.unit,
    tone: band.tone,
    detail: band.detail,
  };
}

function signedNumber(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
  const text = abs.toFixed(digits).replace(/\.0$/, "");
  return (value > 0 ? "+" : value < 0 ? "−" : "±") + text;
}

function previewText(effect: EventEffectView): string {
  if (effect.minDelta != null && effect.maxDelta != null) {
    const unit = effect.unit ? " " + effect.unit : "";
    return effect.label + " " + signedNumber(effect.minDelta) + " ~ " + signedNumber(effect.maxDelta) + unit;
  }
  if (effect.delta != null && Math.abs(effect.delta) >= 0.005) {
    return effect.label + " " + signedNumber(effect.delta) + (effect.unit ? " " + effect.unit : "");
  }
  if (effect.detail) return effect.label + " · " + effect.detail;
  return effect.label;
}

function activeEventView(state: GameState): ActiveEventView | null {
  const eventState = state.events;
  const def = getActiveEvent(eventState);
  if (!def || !eventState) return null;
  const ctx = {
    civ: state.civ,
    tech: state.tech,
    politics: state.politics ?? null,
    hazards: state.hazards,
    era: state.civ.era,
    turn: state.civ.turn,
    year: state.meta.calendarStartYear + state.yearsElapsed,
    difficulty: state.meta.difficulty,
    randomSeed: state.meta.seed,
    elapsedRealSeconds: state.meta.elapsedRealSeconds,
  };
  return {
    defId: def.id,
    title: def.title,
    subtitle: def.subtitle ?? null,
    category: def.category,
    categoryName: EVENT_CATEGORY_NAMES[def.category] ?? def.category,
    illustration: def.illustration,
    short: def.short,
    body: def.body,
    longBody: def.longBody ?? null,
    flavor: def.flavor ?? null,
    triggerYear: state.meta.calendarStartYear + state.yearsElapsed,
    context: eventState.pending[0]?.context ?? "",
    choices: def.choices.map((choice) => {
      const check = isChoiceAvailable(choice, ctx, eventState);
      const bands = forecastEffectBands(choice.effects, ctx, eventState, def.category, forecastEventEffects);
      const effects = bands.map(bandView);
      return {
        id: choice.id,
        label: choice.label,
        description: choice.description,
        risk: choice.risk ?? null,
        available: check.ok,
        unavailableReason: check.ok ? null : check.reason,
        effects,
        bands,
        preview: effects.map(previewText),
      };
    }),
  };
}

function outcomeView(state: GameState): EventOutcomeView | null {
  const report = state.events?.outcomeReport;
  if (!report) return null;
  return {
    id: report.id,
    title: report.title,
    categoryName: EVENT_CATEGORY_NAMES[report.category] ?? report.category,
    choiceLabel: report.choiceLabel,
    outcome: report.outcome,
    turn: report.turn,
    year: report.year,
    summary: report.summary,
    effects: report.effects.map(effectView),
    followUpTitle: report.followUpTitle,
  };
}

export function eventsView(state: GameState): EventsView {
  const eventState: EventState | undefined = state.events;
  const history: EventHistoryView[] = (eventState?.history ?? [])
    .slice(-30)
    .reverse()
    .map((entry) => ({
      id: entry.id,
      defId: entry.defId,
      title: entry.title,
      category: entry.category,
      turn: entry.turn,
      year: entry.year,
      choiceLabel: entry.choiceLabel,
      outcome: entry.outcome,
      illustration: entry.illustration,
    }));
  const lastTitle = history.length > 0 ? history[0].title : null;
  const pending = eventState?.pendingOutcome ?? null;
  const elapsed = state.meta.elapsedRealSeconds;
  return {
    active: activeEventView(state),
    pendingCount: eventState?.pending?.length ?? 0,
    outcomePending: pending
      ? {
          title: pending.title,
          choiceLabel: pending.choiceLabel,
          remainingSeconds: Math.max(0, Math.ceil(pending.dueElapsedSeconds - elapsed)),
        }
      : null,
    outcomeReport: outcomeView(state),
    history,
    modifiers: (eventModifiersView(eventState) ?? []).map((m) => ({
      label: m.label,
      multiplier: Math.round(m.multiplier * 100) / 100,
      tone: m.tone,
    })),
    totalTriggered: eventState?.triggeredTotal ?? 0,
    lastEventTitle: lastTitle,
  };
}
