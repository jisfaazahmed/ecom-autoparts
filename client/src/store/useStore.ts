import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Vehicle, Product } from '@/types';

interface AppState {
  // Vehicle
  userVehicle: Vehicle | null;
  setUserVehicle: (vehicle: Vehicle | null) => void;
  
  // Cart
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Vehicle
      userVehicle: null,
      setUserVehicle: (vehicle) => set({ userVehicle: vehicle }),
      
      // Cart
      cart: [],
      addToCart: (product) =>
        set((state) => {
          const existing = state.cart.find((item) => item.product.id === product.id);
          if (existing) {
            return {
              cart: state.cart.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          }
          return { cart: [...state.cart, { product, quantity: 1 }] };
        }),
      removeFromCart: (productId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.product.id !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        })),
      clearCart: () => set({ cart: [] }),
      getCartTotal: () =>
        get().cart.reduce((total, item) => total + item.product.price * item.quantity, 0),
      getCartCount: () =>
        get().cart.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: 'automotrix-storage',
      partialize: (state) => ({
        cart: state.cart,
        userVehicle: state.userVehicle,
      }),
    }
  )
);
