import { registerRepositories } from "@/lib/di";
import { UserAggregate } from "@/domain/user.agg";
import { PgUserRepo } from "./infra/pg-user.repo";

registerRepositories([
  [UserAggregate, PgUserRepo],
  // [PriceListAggregate, PgPriceListRepo], // Uncomment when ready
]);
