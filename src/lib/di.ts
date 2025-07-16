// di.ts
import Bottle from "bottlejs";

export let container = new Bottle();

// Функция для сброса контейнера в тестах
export function resetContainer() {
  container = new Bottle();
}

// Мапа: Aggregate -> string token
const repositoryMap = new Map<Function, string>();

// 🧠 Мапим агрегат на имя токена
function registerRepository(aggregate: Function, token: string) {
  repositoryMap.set(aggregate, token);
}

// 🧩 Удобная DX-обёртка: регистрирует агрегат + его репозиторий
export function registerRepositories(
  bindings: [Function, new (...args: any[]) => any][]
) {
  for (const [aggregate, repoClass] of bindings) {
    const token = repoClass.name;
    container.service(token, repoClass);
    registerRepository(aggregate, token);
  }
}

// 🪝 Получение репозитория по агрегату
export function useRepository<T = any>(aggregate: Function): T {
  const token = repositoryMap.get(aggregate);
  if (!token)
    throw new Error(`Repository not found for aggregate: ${aggregate.name}`);
  return container.container[token] as T;
}
