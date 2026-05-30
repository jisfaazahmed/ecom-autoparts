import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vehicle } from '@/types';

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
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  setUserVehicle: (vehicle: Vehicle | null) => void;
  triggerVehicleRefresh: () => void;
  setWishlistIds: (ids: string[]) => void;
  toggleWishlistId: (id: string) => void;
  addToCompare: (item: CompareItem) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      cart: [],
      userVehicle: null,
      vehicleRefreshKey: 0,
      wishlistIds: [],
      compareItems: [],
      addToCart: (item) =>
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
        }),
      removeFromCart: (id) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== id),
        })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        })),
      clearCart: () => set({ cart: [] }),
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
