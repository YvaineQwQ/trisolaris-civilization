import { EVENT_DEFS } from "../src/events/definitions.ts";
const ids = new Set(EVENT_DEFS.map(e => e.id));
const issues = [];
const extreme = [];
for (const e of EVENT_DEFS) {
  if (e.eraMin > e.eraMax) issues.push(e.id + " eraMin>eraMax");
  if (!e.choices || e.choices.length < 2) issues.push(e.id + " choices<2");
  for (const c of e.choices ?? []) {
    const f = c.effects ?? {};
    const popPct = f.populationPct ?? 0;
    const pop = f.population ?? 0;
    const stab = f.stability ?? 0;
    const cap = f.capital ?? 0;
    if (Math.abs(popPct) > 0.080001) issues.push(e.id + "/" + c.id + " populationPct " + popPct);
    if (Math.abs(stab) > 12.0001) issues.push(e.id + "/" + c.id + " stability " + stab);
    if (Math.abs(cap) > 15.0001) issues.push(e.id + "/" + c.id + " capital " + cap);
    const food = f.resources?.food ?? 0;
    if (popPct > 0.02 && food < -100) issues.push(e.id + "/" + c.id + " pop+ food- (pop " + popPct + ", food " + food + ")");
    const gains = [stab, cap, popPct*100, food/100, f.resources?.water ?? 0, f.resources?.minerals ?? 0].filter(v => v > 0).length;
    const losses = [stab, cap, popPct*100, food/100, f.resources?.water ?? 0, f.resources?.minerals ?? 0].filter(v => v < 0).length;
    if (c.risk && losses === 0 && gains > 0) issues.push(e.id + "/" + c.id + " risk but no numeric loss");
    if (!c.risk && losses > 0 && gains === 0) issues.push(e.id + "/" + c.id + " pure loss without risk label");
    for (const [k,v] of Object.entries(f.resources ?? {})) {
      if (!Number.isFinite(v)) issues.push(e.id + "/" + c.id + " resource " + k + " not finite");
      if (Math.abs(v) > 5000) extreme.push(e.id + "/" + c.id + " " + k + "=" + v);
    }
  }
  for (const f of e.followUps ?? []) if (!ids.has(f.eventId)) issues.push(e.id + " followUp missing " + f.eventId);
}
console.log("events", EVENT_DEFS.length, "issues", issues.length, "extreme", extreme.length);
console.log(issues.slice(0,80).join("\n"));
console.log("EXTREME", extreme.slice(0,30).join("\n"));
