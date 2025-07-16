import { z } from "zod";
import { randomUUID } from "crypto";
import { UserIdSchema, UserId } from "./user.agg";
import { UsageSchema, Usage } from "./usage.vo";

// --- Value Objects and Schemas ---

export const TransactionIdSchema = z.string().uuid().brand<"TransactionId">();
export type TransactionId = z.infer<typeof TransactionIdSchema>;

export const createTransactionId = (id?: string): TransactionId => {
  return TransactionIdSchema.parse(id || randomUUID());
};

export const TransactionTypeSchema = z.enum(["top-up", "usage"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionStatusSchema = z.enum(["PENDING", "COMPLETED", "FAILED"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TransactionDataSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("top-up"),
    amountCredits: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("usage"),
    usageData: UsageSchema,
    costCredits: z.number().int().negative(), // Стоимость использования всегда отрицательна
  }),
]);
export type TransactionData = z.infer<typeof TransactionDataSchema>;

export const TransactionPropsSchema = z.object({
  id: TransactionIdSchema,
  userId: UserIdSchema,
  timestamp: z.date(),
  status: TransactionStatusSchema,
  data: TransactionDataSchema,
});
export type TransactionProps = z.infer<typeof TransactionPropsSchema>;

// --- Aggregate Root ---

export class TransactionAggregate {
  static name: string = "Transaction";
  private props: TransactionProps;

  private constructor(props: TransactionProps) {
    TransactionPropsSchema.parse(props);
    this.props = props;
  }

  public static createTopUp(
    userId: UserId,
    amountCredits: number,
    status: TransactionStatus = "PENDING"
  ): TransactionAggregate {
    return new TransactionAggregate({
      id: createTransactionId(),
      userId,
      timestamp: new Date(),
      status,
      data: { type: "top-up", amountCredits },
    });
  }

  public static createUsage(
    userId: UserId,
    usageData: Usage,
    costCredits: number,
    status: TransactionStatus = "COMPLETED"
  ): TransactionAggregate {
    return new TransactionAggregate({
      id: createTransactionId(),
      userId,
      timestamp: new Date(),
      status,
      data: { type: "usage", usageData, costCredits },
    });
  }

  public static restore(props: TransactionProps): TransactionAggregate {
    return new TransactionAggregate(props);
  }

  public complete(): void {
    if (this.props.status === "PENDING") {
      this.props.status = "COMPLETED";
    } else {
      throw new Error("Transaction cannot be completed from current status.");
    }
  }

  public fail(): void {
    if (this.props.status === "PENDING") {
      this.props.status = "FAILED";
    } else {
      throw new Error("Transaction cannot be failed from current status.");
    }
  }

  public get id(): TransactionId {
    return this.props.id;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get timestamp(): Date {
    return this.props.timestamp;
  }

  public get status(): TransactionStatus {
    return this.props.status;
  }

  public get data(): TransactionData {
    return this.props.data;
  }

  public getProps(): TransactionProps {
    return { ...this.props };
  }
}
