export class ExclusiveActionRunner<Action extends string> {
  #active: Action | undefined;
  readonly #onChange: () => void;

  constructor(onChange: () => void = () => undefined) {
    this.#onChange = onChange;
  }

  get active(): Action | undefined {
    return this.#active;
  }

  async run(action: Action, operation: () => void | Promise<void>): Promise<boolean> {
    if (this.#active !== undefined) return false;
    this.#active = action;
    this.#onChange();
    try {
      await operation();
      return true;
    } finally {
      if (this.#active === action) this.#active = undefined;
      this.#onChange();
    }
  }
}
