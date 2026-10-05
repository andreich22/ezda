import {describe, expect, it} from "vitest";
import {
  createRouteCatalogCache,
  serializeRouteCatalogCacheKey,
} from "../lib/route-catalog-cache";

const page = {items: ["route"], page: 1, pageSize: 50, total: 1, hasNextPage: false};

describe("route catalog cache", () => {
  it("includes user, visibility, page and page size in the cache key", () => {
    const base = {userId: "user-a", visibility: "all" as const, page: 1, pageSize: 50};
    expect(serializeRouteCatalogCacheKey(base)).toBe("user-a:all:1:50");
    expect(serializeRouteCatalogCacheKey({...base, page: 2})).not.toBe(
      serializeRouteCatalogCacheKey(base),
    );
    expect(serializeRouteCatalogCacheKey({...base, visibility: "public"})).not.toBe(
      serializeRouteCatalogCacheKey(base),
    );
    expect(serializeRouteCatalogCacheKey({...base, userId: "user-b"})).not.toBe(
      serializeRouteCatalogCacheKey(base),
    );
  });

  it("expires stale entries", () => {
    const cache = createRouteCatalogCache<typeof page>(100);
    const key = {userId: "user-a", visibility: "private" as const, page: 1, pageSize: 50};
    cache.set(key, page, 1000);
    expect(cache.get(key, 1099)).toEqual(page);
    expect(cache.get(key, 1100)).toBeUndefined();
  });

  it("invalidates only the selected user's entries", () => {
    const cache = createRouteCatalogCache<typeof page>();
    const own = {userId: "user-a", visibility: "private" as const, page: 1, pageSize: 50};
    const other = {userId: "user-b", visibility: "private" as const, page: 1, pageSize: 50};
    cache.set(own, page);
    cache.set(other, page);
    cache.invalidateUser("user-a");
    expect(cache.get(own)).toBeUndefined();
    expect(cache.get(other)).toEqual(page);
  });
});
