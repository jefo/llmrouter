import { IUserRepo, UserAggregate, UserId } from "../domain/user.agg";

/**
 * PostgreSQL User Repository
 */
export class PgUserRepo implements IUserRepo {
  save(user: UserAggregate): Promise<void> {
    throw new Error("Method not implemented.");
  }
  findById(id: UserId): Promise<UserAggregate | null> {
    throw new Error("Method not implemented.");
  }
  findByTelegramId(telegramId: number): Promise<UserAggregate | null> {
    throw new Error("Method not implemented.");
  }
}
