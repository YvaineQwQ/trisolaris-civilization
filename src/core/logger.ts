import type { LogEntry } from "./types";

export type LogCategory = LogEntry["category"];
export type LogSeverity = LogEntry["severity"];

export interface LogSink {
  add(entry: LogEntry): void;
}

/** Central in-memory log with a bounded ring buffer. */
export class GameLog {
  private entries: LogEntry[] = [];
  private nextId = 1;
  private maxEntries: number;
  private sinks: LogSink[] = [];

  constructor(maxEntries = 600) {
    this.maxEntries = maxEntries;
  }

  add(
    category: LogCategory,
    severity: LogSeverity,
    message: string,
    year: number,
    turn: number,
  ): LogEntry {
    const entry: LogEntry = {
      id: this.nextId++,
      year,
      turn,
      category,
      severity,
      message,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    for (const sink of this.sinks) sink.add(entry);
    return entry;
  }

  subscribe(sink: LogSink): void {
    this.sinks.push(sink);
  }

  all(): LogEntry[] {
    return this.entries;
  }

  recent(n = 40): LogEntry[] {
    return this.entries.slice(-n).reverse();
  }

  clear(): void {
    this.entries = [];
  }

  restore(entries: LogEntry[], nextId: number): void {
    this.entries = entries.slice(-this.maxEntries);
    this.nextId = Math.max(1, nextId);
  }

  get lastId(): number {
    return this.nextId;
  }
}
