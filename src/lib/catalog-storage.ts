import { CatalogCategory, CatalogProduct } from "@/app/actions";

export const CATALOG_STORAGE_KEY = "growsary_catalog_cache_v1";
export const CATALOG_SYNC_EVENT = "growsary_catalog_cache_sync";

export interface CachedCatalogData {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  cachedAt: number;
  version: number;
}

const CURRENT_CACHE_VERSION = 1;

/**
 * Safely retrieves and parses the cached catalog from browser localStorage.
 * Returns null if running on the server, if cache is missing, corrupted, or version-mismatched.
 */
export function loadCachedCatalog(): CachedCatalogData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;

    const data: CachedCatalogData = JSON.parse(raw);

    // Schema runtime validation
    if (
      data &&
      data.version === CURRENT_CACHE_VERSION &&
      Array.isArray(data.products) &&
      Array.isArray(data.categories) &&
      typeof data.cachedAt === "number"
    ) {
      return data;
    }

    // Invalidate stale or invalid cache versions
    localStorage.removeItem(CATALOG_STORAGE_KEY);
    return null;
  } catch (err) {
    console.warn("Failed to load catalog cache from localStorage:", err);
    return null;
  }
}

/**
 * Persists products and categories list to localStorage with timestamp and version metadata.
 * Triggers a custom window event for same-tab subscribers.
 */
export function saveCachedCatalog(
  products: CatalogProduct[],
  categories: CatalogCategory[]
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const payload: CachedCatalogData = {
      products,
      categories,
      cachedAt: Date.now(),
      version: CURRENT_CACHE_VERSION,
    };

    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(payload));

    // Notify same-tab listeners (window.onstorage only fires across different tabs/windows)
    window.dispatchEvent(
      new CustomEvent(CATALOG_SYNC_EVENT, { detail: payload })
    );

    return true;
  } catch (err) {
    console.error("Failed to save catalog cache to localStorage (quota exceeded?):", err);
    return false;
  }
}

/**
 * Clears the catalog cache from browser localStorage.
 */
export function clearCachedCatalog(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(CATALOG_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(CATALOG_SYNC_EVENT, { detail: null })
    );
  } catch (err) {
    console.error("Failed to clear catalog cache from localStorage:", err);
  }
}
