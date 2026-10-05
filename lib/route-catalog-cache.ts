export type RouteCatalogVisibility = "all" | "my" | "public" | "private";

export type RouteCatalogCacheKey = {
  userId: string | null;
  visibility: RouteCatalogVisibility;
  page: number;
  pageSize: number;
};

export function serializeRouteCatalogCacheKey(key: RouteCatalogCacheKey) {
  return [
    key.userId ?? "anonymous",
    key.visibility,
    String(key.page),
    String(key.pageSize),
  ].join(":");
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function createRouteCatalogCache<T>(ttlMs = 30_000) {
  const entries = new Map<string, CacheEntry<T>>();

  return {
    get(key: RouteCatalogCacheKey, now = Date.now()) {
      const serialized = serializeRouteCatalogCacheKey(key);
      const entry = entries.get(serialized);
      if (!entry) return undefined;

      if (entry.expiresAt <= now) {
        entries.delete(serialized);
        return undefined;
      }

      return entry.value;
    },

    set(key: RouteCatalogCacheKey, value: T, now = Date.now()) {
      entries.set(serializeRouteCatalogCacheKey(key), {
        value,
        expiresAt: now + ttlMs,
      });
    },

    invalidateUser(userId: string | null) {
      const prefix = (userId ?? "anonymous") + ":";
      for (const key of entries.keys()) {
        if (key.startsWith(prefix)) entries.delete(key);
      }
    },

    clear() {
      entries.clear();
    },

    size() {
      return entries.size;
    },
  };
}

const routeCatalogCache = createRouteCatalogCache<unknown>();

export function getRouteCatalogCache<T>() {
  return routeCatalogCache as ReturnType<typeof createRouteCatalogCache<T>>;
}

export function invalidateRouteCatalogCache(userId?: string | null) {
  if (userId === undefined) {
    routeCatalogCache.clear();
  } else {
    routeCatalogCache.invalidateUser(userId);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ezda:route-catalog-invalidate"));
  }
}
