import { Injectable, Logger } from "@nestjs/common";

export interface DeadLetterEntry {
  id: string;
  task: string;
  modelsAttempted: string[];
  error: string;
  promptSnippet: string;
  timestamp: string;
  retriesExhausted: number;
  totalDurationMs: number;
}

@Injectable()
export class LlmDeadLetterQueue {
  private readonly logger = new Logger(LlmDeadLetterQueue.name);
  private readonly entries: DeadLetterEntry[] = [];
  private readonly maxEntries = 100;

  recordFailure(entry: Omit<DeadLetterEntry, "id" | "timestamp">): DeadLetterEntry {
    const fullEntry: DeadLetterEntry = {
      ...entry,
      id: `dlq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    if (this.entries.length >= this.maxEntries) {
      this.entries.shift(); // FIFO eviction
    }

    this.entries.push(fullEntry);
    this.logger.error(
      `[LLM DEAD LETTER QUEUE] Recorded failed LLM task "${entry.task}" (models: ${entry.modelsAttempted.join(", ")}): ${entry.error}`,
    );

    return fullEntry;
  }

  getEntries(limit = 20): DeadLetterEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  clear(): void {
    this.entries.length = 0;
  }

  getStats(): { totalLogged: number; latestError: string | null } {
    return {
      totalLogged: this.entries.length,
      latestError: this.entries.length > 0 ? this.entries[this.entries.length - 1].error : null,
    };
  }
}

