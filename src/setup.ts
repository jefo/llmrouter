import { UserAggregate } from "./domain/user.agg";
import { PgUserRepo } from "./infra/pg-user.repo";
import { registerRepositories } from "./lib/di";

registerRepositories([[UserAggregate, PgUserRepo]]);
