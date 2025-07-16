import { z } from "zod";

// --- Value Objects and Schemas ---

/**
 * Схема для цены одной модели.
 * Содержит ID модели и цены за 1M токенов в копейках.
 */
export const PriceSchema = z.object({
  modelName: z.string(),
  inputPriceCreditsPer1M: z.number(),
  outputPriceCreditsPer1M: z.number(),
  isActive: z.boolean(),
});
export type Price = z.infer<typeof PriceSchema>;

/**
 * Схема свойств для агрегата PriceList.
 */
export const PriceListPropsSchema = z.object({
  id: z.string().uuid(),
  prices: z.array(PriceSchema),
  createdAt: z.date(),
});
export type PriceListProps = z.infer<typeof PriceListPropsSchema>;

// --- Aggregate Root ---

/**
 * Агрегат PriceList.
 * Представляет собой полный прайс-лист всех доступных моделей в системе.
 */
export class PriceListAggregate {
  static name: string = "PriceList";
  private props: PriceListProps;

  private constructor(props: PriceListProps) {
    this.props = props;
  }

  /**
   * Восстанавливает прайс-лист из хранилища.
   */
  public static restore(props: PriceListProps): PriceListAggregate {
    return new PriceListAggregate(props);
  }

  /**
   * Возвращает список только активных цен.
   */
  public getActivePrices(): Readonly<Price[]> {
    return this.props.prices.filter((p) => p.isActive);
  }

  public getProps(): PriceListProps {
    return { ...this.props };
  }
}

// --- Repository Contract ---

export interface IPriceListRepo {
  findActive(): Promise<PriceListAggregate | null>;
}
