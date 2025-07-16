import { PriceListAggregate } from "@/domain/pricelist.agg";
import { randomUUID } from "crypto";

export class InMemoryPriceListRepo implements IPriceListRepo {
  private priceLists = new Map<string, PriceListAggregate>();

  async findActive(): Promise<PriceListAggregate | null> {
    // В InMemory реализации просто возвращаем первый (и единственный) прайс-лист
    return this.priceLists.values().next().value || null;
  }

  // Helper for tests
  public add(priceList: PriceListAggregate): void {
    this.priceLists.set(priceList.getProps().id, priceList);
  }

  public clear(): void {
    this.priceLists.clear();
  }
}
