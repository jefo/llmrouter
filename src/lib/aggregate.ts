import { z } from 'zod';

// A generic type for any domain event
interface IDomainEvent {
  aggregateId: string;
  timestamp: Date;
}

// The configuration object that a developer provides
export interface AggregateConfig<TProps, TActions extends Record<string, any>> {
  name: string;
  schema: z.ZodType<TProps>;
  invariants: Array<(state: TProps) => void>;
  actions: TActions;
}

/**
 * A factory function that creates a robust, behavior-rich Aggregate class.
 * @param config - The declarative configuration for the aggregate.
 * @returns A class representing the configured Aggregate.
 */
export function createAggregate<TProps extends { id: string }, TActions extends Record<string, (state: TProps, ...args: any[]) => { state: TProps; event?: IDomainEvent }>>(
  config: AggregateConfig<TProps, TActions>
) {
  return class Aggregate {
    private props: TProps;
    private pendingEvents: IDomainEvent[] = [];

    // The constructor is private to enforce creation via the static `create` method.
    private constructor(props: TProps) {
      this.props = props;
    }

    /**
     * The only public way to create a new instance of the Aggregate.
     * It validates the initial data against the schema.
     * @param initialData - The raw data for creating the aggregate.
     */
    public static create(initialData: unknown): Aggregate {
      const validatedProps = config.schema.parse(initialData);
      return new Aggregate(validatedProps);
    }

    /**
     * Read-only access to the aggregate's current state.
     */
    get state(): Readonly<TProps> {
      return Object.freeze({ ...this.props });
    }

    /**
     * Retrieves the list of domain events that have been generated but not yet dispatched.
     * This method also clears the list of pending events.
     */
    public getPendingEvents(): IDomainEvent[] {
      const events = [...this.pendingEvents];
      this.pendingEvents = []; // Clear events after retrieval
      return events;
    }

    /**
     * Clears the pending event queue. Should be called by the repository after events are dispatched.
     */
    public clearEvents(): void {
      this.pendingEvents = [];
    }

    /**
     * A protected method to add a domain event to the pending list.
     * Used by the static `create` method or within actions.
     */
    public addDomainEvent(event: IDomainEvent): void {
      this.pendingEvents.push(event);
    }

    /**
     * A proxy-like object that exposes the actions as callable methods.
     * This is the only way to modify the aggregate's state.
     */
    public readonly actions = Object.keys(config.actions).reduce((acc, actionName) => {
      acc[actionName as keyof TActions] = (...args: any[]) => {
        // 1. Execute the action's pure function to get the potential new state and event.
        const { state: nextState, event } = config.actions[actionName](this.props, ...args);

        // 2. Check all invariants against the potential new state.
        for (const invariant of config.invariants) {
          try {
            invariant(nextState);
          } catch (error) {
            // If an invariant fails, we reject the state change and re-throw the error.
            console.error(`Invariant failed for ${config.name}.${actionName}:`, error);
            throw error;
          }
        }

        // 3. If all invariants pass, commit the new state.
        this.props = nextState;

        // 4. If the action produced an event, add it to the pending list.
        if (event) {
          this.pendingEvents.push(event);
        }
      };
      return acc;
    }, {} as { [K in keyof TActions]: (...args: Parameters<TActions[K]>[1][]) => void });
  };
}
