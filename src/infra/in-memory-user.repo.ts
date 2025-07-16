import { IUserRepo, UserAggregate, UserId } from "../../domain/user.agg";

export class InMemoryUserRepo implements IUserRepo {
  private users = new Map<UserId, UserAggregate>();

  async save(user: UserAggregate): Promise<void> {
    this.users.set(user.id, user);
  }

  async findById(id: UserId): Promise<UserAggregate | null> {
    return this.users.get(id) || null;
  }

  async findByTelegramId(telegramId: number): Promise<UserAggregate | null> {
    for (const user of this.users.values()) {
      if (user.telegramId === telegramId) {
        return user;
      }
    }
    return null;
  }

  // Helper for tests
  public clear(): void {
    this.users.clear();
  }
}
