import { z, ZodType } from "zod";
import { createAggregate, IAggregate } from "./aggregate";

// Define the configuration for the linker factory
interface RelationConfig<
	TEntityA extends IAggregate,
	TEntityB extends IAggregate,
> {
	name: string;
	schemaA: ZodType<TEntityA["state"]>;
	schemaB: ZodType<TEntityB["state"]>;
	link: (payload: { entityA: TEntityA; entityB: TEntityB }) => void;
}

/**
 * A factory function to create a transactional linker aggregate.
 * This standardizes the pattern of atomically updating two entities.
 */
export function createRelation<TEntityA extends IAggregate, TEntityB extends IAggregate>(
  config: RelationConfig<TEntityA, TEntityB>
) {
  const { name, schemaA, schemaB, link: linkFn } = config;

  return createAggregate({
    name,
    schema: z.object({ entityA: schemaA, entityB: schemaB }).optional(),
    invariants: [], // Relations typically don't have their own invariants
    actions: {
      link: (state, payload: { entityA: TEntityA; entityB: TEntityB }) => {
        const { entityA, entityB } = payload;

        // 1. Execute the user-defined linking logic which mutates the entities
        linkFn({ entityA, entityB });

        // 2. Return the new state containing the modified entities, as required by createAggregate
        return { state: { entityA, entityB } };
      },
    },
  });
}