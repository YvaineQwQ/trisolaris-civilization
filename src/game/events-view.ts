/**
 * EventsView assembly (v1.5): quantified choices + 30s delayed outcome report.
 */
import type { EventEffectForecast, EventState, GameState } from "../core/types";
import {
  EVENT_CATEGORY_NAMES, eventModifiersView, forecastEventEffects, getActiveEvent, isChoiceAvailable,
} from "../events";
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

function signedNumber(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
  const text = abs.toFixed(digits).replace(/\.0$/, "");
  return (value > 0 ? "+" : value < 0 ? "−" : "±") + text;
}

function previewText(effect: EventEffectView): string {
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
      const effects = forecastEventEffects(choice.effects, ctx).map(effectView);
      return {
        id: choice.id,
        label: choice.label,
        description: choice.description,
        risk: choice.risk ?? null,
        available: check.ok,
        unavailableReason: check.ok ? null : check.reason,
        effects,
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
