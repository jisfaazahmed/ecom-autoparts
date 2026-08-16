import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vehicle } from '@/types';
import { api, ApiCartItem, ApiProduct } from '@/lib/api';

interface CartItem {
  id: string;
  product: {
    id: string;
    _id?: string;
    name: string;
    price: number;
    weight?: number;
    image: string;
    shopId?: string;
    brand?: string;
    sku?: string;
    description?: string;
    category?: string;
    shopName?: string;
    stock?: number;
    compatibleVehicles?: Array<Record<string, unknown>> | string[];
    rating?: number;
    reviewCount?: number;
  };
  quantity: number;
}

export interface CompareItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
  brand?: string;
  stock?: number | string;
  rating?: number | string;
  reviewCount?: number;
  sku?: string;
  shopName?: string;
  shopId?: string;
}

interface StoreState {
  cart: CartItem[];
  userVehicle: Vehicle | null;
  vehicleRefreshKey: number;
  wishlistIds: string[];
  compareItems: CompareItem[];
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Clears local cart/vehicle without calling the API (e.g. on sign-out). */
  resetLocalCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  setUserVehicle: (vehicle: Vehicle | null) => void;
  triggerVehicleRefresh: () => void;
  syncCartFromApi: () => Promise<void>;
  setWishlistIds: (ids: string[]) => void;
  toggleWishlistId: (id: string) => void;
  addToCompare: (item: CompareItem) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
}

/**
 * Maps an API cart item (with populated product) to the local CartItem shape.
 */
const mapApiCartItemToLocal = (apiItem: ApiCartItem): CartItem | null => {
  const p = apiItem.product;
  // If the product was not populated (just an ID string), skip it
  if (!p || typeof p === 'string') return null;

  const product = p as ApiProduct & { _id?: string | { toString(): string } };
  const rawId = product.id || product._id;
  const productId = rawId ? String(typeof rawId === 'object' ? rawId.toString() : rawId) : '';
  if (!productId) return null;

  const categoryName =
    product.category && typeof product.category === 'object'
      ? product.category.name || ''
      : '';

  return {
    id: productId,
    product: {
      id: productId,
      _id: productId,
      name: product.name,
      price: product.price,
      weight: product.weight,
      image: product.imageUrl || product.image_url || product.image || '/placeholder.svg',
      shopId: product.shopId,
      brand: '',
      sku: product.sku || '',
      description: product.description || '',
      category: categoryName,
      shopName: product.shop?.name || '',
      stock: product.stock,
      compatibleVehicles: product.compatibleVariants || [],
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
    },
    quantity: apiItem.quantity,
  };
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      userVehicle: null,
      vehicleRefreshKey: 0,
      wishlistIds: [],
      compareItems: [],

      addToCart: async (item) => {
        // Optimistic update
        const prevCart = get().cart;
        set((state) => {
          const existing = state.cart.find((i) => i.id === item.id);
          if (existing) {
            return {
              cart: state.cart.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
              ),
            };
          }
          return { cart: [...state.cart, item] };
        });

        try {
          const productId = item.product._id || item.product.id || item.id;
          const response = await api.addToCart({ productId, quantity: item.quantity });
          // Sync with server response
          const serverCart = (response.cart?.items || [])
            .map(mapApiCartItemToLocal)
            .filter((i): i is CartItem => i !== null);
          set({ cart: serverCart });
        } catch (error) {
          // Rollback on failure
          set({ cart: prevCart });
          throw error;
        }
      },

      removeFromCart: async (id) => {
        const prevCart = get().cart;
        // Optimistic update
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== id),
        }));

        try {
          const response = await api.removeFromCart(id);
          const serverCart = (response.cart?.items || [])
            .map(mapApiCartItemToLocal)
            .filter((i): i is CartItem => i !== null);
          set({ cart: serverCart });
        } catch (error) {
          set({ cart: prevCart });
          throw error;
        }
      },

      updateQuantity: async (id, quantity) => {
        const prevCart = get().cart;
        // Optimistic update
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        }));

        try {
          const response = await api.updateCartItem(id, quantity);
          const serverCart = (response.cart?.items || [])
            .map(mapApiCartItemToLocal)
            .filter((i): i is CartItem => i !== null);
          set({ cart: serverCart });
        } catch (error) {
          set({ cart: prevCart });
          throw error;
        }
      },

      clearCart: async () => {
        const prevCart = get().cart;
        set({ cart: [] });

        try {
          await api.clearCart();
        } catch (error) {
          set({ cart: prevCart });
          throw error;
        }
      },

      resetLocalCart: () => {
        set({ cart: [], userVehicle: null });
      },

      getCartTotal: () => {
        const { cart } = get();
        return cart.reduce((total, item) => total + ((item.product?.price || 0) * item.quantity), 0);
      },

      getCartCount: () => {
        const { cart } = get();
        return cart.reduce((count, item) => count + item.quantity, 0);
      },

      setUserVehicle: (vehicle) => set({ userVehicle: vehicle }),

      triggerVehicleRefresh: () =>
        set((state) => ({ vehicleRefreshKey: state.vehicleRefreshKey + 1 })),

      syncCartFromApi: async () => {
        try {
          // Avoid race where persist rehydration overwrites a freshly synced cart.
          await new Promise<void>((resolve) => {
            if (useStore.persist.hasHydrated()) {
              resolve();
              return;
            }
            const unsub = useStore.persist.onFinishHydration(() => {
              unsub();
              resolve();
            });
          });

          const response = await api.getCart();
          const serverCart = (response.cart?.items || [])
            .map(mapApiCartItemToLocal)
            .filter((i): i is CartItem => i !== null);
          set({ cart: serverCart });
        } catch {
          // If fetch fails (e.g. not authenticated), keep local cart
        }
      },

      setWishlistIds: (ids) => set({ wishlistIds: ids }),
      toggleWishlistId: (id) =>
        set((state) => ({
          wishlistIds: state.wishlistIds.includes(id)
            ? state.wishlistIds.filter((w) => w !== id)
            : [...state.wishlistIds, id],
        })),
      addToCompare: (item) =>
        set((state) => {
          if (state.compareItems.length >= 4) return state;
          if (state.compareItems.some((c) => c.id === item.id)) return state;
          return { compareItems: [...state.compareItems, item] };
        }),
      removeFromCompare: (id) =>
        set((state) => ({ compareItems: state.compareItems.filter((c) => c.id !== id) })),
      clearCompare: () => set({ compareItems: [] }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cart: state.cart,
        userVehicle: state.userVehicle,
        wishlistIds: state.wishlistIds,
        compareItems: state.compareItems,
      }),
    }
  )
);
