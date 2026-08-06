import { describe, it, expect } from "vitest";
import { LRUCache } from "./LRUCache";

describe("LRUCache — basic get/set", () => {
    it("stores and retrieves values", () => {
        const cache = new LRUCache<string, number>(3);
        cache.set("a", 1);
        expect(cache.get("a")).toBe(1);
        expect(cache.has("a")).toBe(true);
        expect(cache.size).toBe(1);
    });

    it("returns undefined for a missing key", () => {
        const cache = new LRUCache<string, number>(3);
        expect(cache.get("missing")).toBeUndefined();
        expect(cache.has("missing")).toBe(false);
    });
});

describe("LRUCache — eviction order", () => {
    it("evicts the least-recently-used entry once maxSize is exceeded", () => {
        const cache = new LRUCache<string, number>(2);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("c", 3); // should evict "a" (oldest, never re-accessed)

        expect(cache.has("a")).toBe(false);
        expect(cache.has("b")).toBe(true);
        expect(cache.has("c")).toBe(true);
        expect(cache.size).toBe(2);
    });

    it("accessing a key via get() promotes it, saving it from eviction", () => {
        const cache = new LRUCache<string, number>(2);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.get("a"); // "a" is now most-recently-used; "b" becomes oldest
        cache.set("c", 3); // should evict "b", not "a"

        expect(cache.has("a")).toBe(true);
        expect(cache.has("b")).toBe(false);
        expect(cache.has("c")).toBe(true);
    });

    it("re-setting an existing key refreshes its recency without growing the cache", () => {
        const cache = new LRUCache<string, number>(2);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("a", 10); // refresh "a"; "b" is now oldest
        cache.set("c", 3); // should evict "b"

        expect(cache.size).toBe(2);
        expect(cache.get("a")).toBe(10);
        expect(cache.has("b")).toBe(false);
        expect(cache.has("c")).toBe(true);
    });
});

describe("LRUCache — delete and clear", () => {
    it("delete() removes a key and reports whether it existed", () => {
        const cache = new LRUCache<string, number>(3);
        cache.set("a", 1);

        expect(cache.delete("a")).toBe(true);
        expect(cache.has("a")).toBe(false);
        expect(cache.delete("a")).toBe(false);
    });

    it("clear() empties the cache", () => {
        const cache = new LRUCache<string, number>(3);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.clear();

        expect(cache.size).toBe(0);
        expect(cache.has("a")).toBe(false);
    });
});

describe("LRUCache — constructor validation", () => {
    it("throws for a non-positive maxSize", () => {
        expect(() => new LRUCache(0)).toThrow(/positive/i);
        expect(() => new LRUCache(-1)).toThrow(/positive/i);
    });

    it("throws for a non-finite maxSize", () => {
        expect(() => new LRUCache(Infinity)).toThrow(/positive/i);
        expect(() => new LRUCache(NaN)).toThrow(/positive/i);
    });
});
