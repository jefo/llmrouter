import { IUsageCostCalculator } from "../interfaces";
import { Usage } from "../usage.vo";
import { PriceListAggregate } from "../pricelist.agg";

export class UsageCostCalculator implements IUsageCostCalculator {
  calculate(usageData: Usage, priceList: PriceListAggregate): number {
    const price = priceList
      .getActivePrices()
      .find((p) => p.modelName === usageData.model_name);

    if (!price) {
      // Если модель не найдена в прайс-листе, возможно, стоит бросить ошибку или вернуть 0
      // В данном случае, возвращаем 0, так как это может быть новая модель или ошибка конфигурации
      return 0;
    }

    const inputCost = (usageData.prompt_tokens / 1_000_000) * price.inputPriceCreditsPer1M;
    const outputCost = (usageData.completion_tokens / 1_000_000) * price.outputPriceCreditsPer1M;

    return inputCost + outputCost;
  }
}
