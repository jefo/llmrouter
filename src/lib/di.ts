// di.ts
import Bottle from "bottlejs";

export let container = new Bottle();

// Функция для сброса контейнера в тестах
export function resetContainer() {
  container = new Bottle();
}

// Мапа: Aggregate.name (string) -> string token (implementationClass.name)
const repositoryMap = new Map<string, string>();

// 🧠 Мапим агрегат на имя токена
function registerRepository(aggregateName: string, token: string) {
  repositoryMap.set(aggregateName, token);
}

// 🧩 Удобная DX-обёртка: регистрирует агрегат + его репозиторий
// bindings: [ [AggregateClass, RepoClass], ... ]
export function registerRepositories(
  bindings: [Function, new (...args: any[]) => any][]
) {
  for (const [aggregate, repoClass] of bindings) {
    const token = repoClass.name;
    container.service(token, repoClass);
    registerRepository((aggregate as any).name, token); // Use static name of aggregate
  }
}

// 🪝 Получение репозитория по агрегату
export function useRepository<T = any>(aggregate: Function): T {
  const identifier = (aggregate as any).name; // Get static name of the aggregate
  const token = repositoryMap.get(identifier);
  if (!token)
    throw new Error(`Repository not found for aggregate: ${identifier}`);
  return container.container[token] as T;
}