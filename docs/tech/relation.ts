import { z } from "zod";
import { createAggregate, createId, type ActionContext } from "@elonx/ddd";
import { RequirementSchema, type RequirementIdType } from "../entities";

export const DeriveReqIdSchema = createId("DeriveReqId");
export type DeriveReqId = z.infer<typeof DeriveReqIdSchema.schema>;

// Define the state for the DeriveRequirementAggregate
export const DeriveRequirementAggregateSchema = z.object({
	id: DeriveReqIdSchema, // Unique ID for this operation
	requirement: RequirementSchema,
	derivedRequirements: z.array(RequirementSchema).default([]),
});

export type DeriveRequirementAggregateProps = z.infer<
	typeof DeriveRequirementAggregateSchema
>;

// Define the DeriveRequirementAggregate
export const DeriveRequirementAggregate = createAggregate<
	DeriveRequirementAggregateProps,
	DeriveReqId,
	{
		derive: (
			context: ActionContext<
				DeriveRequirementAggregateProps,
				{
					requirement: RequirementIdType;
					derivedRequirements: RequirementIdType[];
				}
			>,
		) => void;
	}
>({
	name: "DeriveRequirement",
	schema: DeriveRequirementAggregateSchema,
	identity: (state) => state.id,
	actions: {
		derive: ({ payload, update }) => {
			update((state: DeriveRequirementAggregateProps) => {
				state.requirement.derives.push(...payload.derivedRequirements);
				for (const derived of state.derivedRequirements) {
					derived.derivedFrom = payload.requirement;
				}
			});
		},
	},
});

export type DeriveRequirement = ReturnType<
	typeof DeriveRequirementAggregate.create
>;
export interface IDeriveRequirementRepository {
	findById(id: string): Promise<typeof DeriveRequirementAggregate | null>;
	save(aggregate: typeof DeriveRequirementAggregate): Promise<void>;
}
