export type CircuitState = "closed" | "open" | "half_open";

export type CircuitOptions = {
  failureThreshold: number;
  openTimeoutMs: number;
};

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = "closed";
  private openedAt = 0;

  constructor(private readonly options: CircuitOptions) {}

  getState() {
    if (this.state === "open" && Date.now() - this.openedAt > this.options.openTimeoutMs) {
      this.state = "half_open";
    }
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "open") {
      throw new Error("circuit_open");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
