const locks = new Map<string, Promise<void>>();

export async function withResourceLock<T>(resourceKey: string, fn: () => Promise<T>): Promise<T> {
  while (locks.has(resourceKey)) {
    try {
      await locks.get(resourceKey);
    } catch {
      // Ignore errors from preceding lock
    }
  }

  let resolveLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  locks.set(resourceKey, lockPromise);

  try {
    return await fn();
  } finally {
    locks.delete(resourceKey);
    resolveLock();
  }
}
