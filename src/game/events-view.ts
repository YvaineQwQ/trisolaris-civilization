/**
 * EventsView assembly (v1.3). Lead-owned presentation adapter.
 */
import type { EventState, GameState } from "../core/types";
import {
  EVENT_CATEGORY_NAMES, effectKeywords, eventModifiersView, getActiveEvent, isChoiceAvailable,
} from "../events";
import type { ActiveEventView, EventHistoryView, EventsView } from "./viewTypes";

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
      return {
        id: choice.id,
        label: choice.label,
        description: choice.description,
        risk: choice.risk ?? null,
        available: check.ok,
        unavailableReason: check.ok ? null : check.reason,
        preview: effectKeywords(choice.effects),
      };
    }),
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
  return {
    active: activeEventView(state),
    pendingCount: eventState?.pending?.length ?? 0,
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
