// Fixed-capacity LRU cache implementing the "Map" methods used by "lodash.memoize",
// requiring "get", "set", "has", "delete".
//
// Example:
//
//   const fn = memoize(expensiveFn, hashArgs);
//   fn.cache = new LRUCache(500);
//
// This bounds the cache size instead of using lodash.memoize's default unbounded Map.
export class LRUCache<K, V> {
    private readonly maxSize: number;
    private readonly map = new Map<K, V>();

    constructor(maxSize: number) {
        if (!Number.isFinite(maxSize) || maxSize <= 0) {
            throw new Error("LRUCache maxSize must be a positive number");
        }
        this.maxSize = maxSize;
    }

    get size(): number {
        return this.map.size;
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    get(key: K): V | undefined {
        if (!this.map.has(key)) {
            return undefined;
        }
        // Re-insert so this key becomes the most-recently-used entry (Map
        // iteration/eviction order below is insertion order).
        const value = this.map.get(key) as V;
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    set(key: K, value: V): this {
        if (this.map.has(key)) {
            // Refresh recency for an existing key.
            this.map.delete(key);
        } else if (this.map.size >= this.maxSize) {
            // Evict the least-recently-used entry: the first key in
            // insertion order.
            const oldestKey = this.map.keys().next().value;
            if (oldestKey !== undefined) {
                this.map.delete(oldestKey);
            }
        }
        this.map.set(key, value);
        return this;
    }

    delete(key: K): boolean {
        return this.map.delete(key);
    }

    clear(): void {
        this.map.clear();
    }
}
