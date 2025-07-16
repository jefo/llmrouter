import { z } from "zod";

/**
 * Схема для Value Object Usage.
 * Содержит данные о потреблении токенов.
 */
export const UsageSchema = z.object({
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
  model_name: z.string().min(1),
});

export type Usage = z.infer<typeof UsageSchema>;

/**
 * Фабричная функция для создания Usage Value Object.
 */
export const createUsage = (data: Usage): Usage => {
  return UsageSchema.parse(data);
};
