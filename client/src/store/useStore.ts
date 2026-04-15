import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Vehicle, Product } from '@/types';
import { api, ApiCart, ApiCartItem, ApiProduct } from '@/lib/api';

// Helper to map an API product (from backend cart) to the frontend Product type
const mapApiProductToProduct = (p: ApiProduct): Product => ({
  id: p.id || p._id || '',
  name: p.name,
  description: p.description || '',
  price: p.price,
  image: p.imageUrl || p.image_url || p.image || '/placeholder.svg',
  images: p.images,
  category: p.category?.name || 'Uncategorized',
  categoryId: p.categoryId,
  brand: '',
  shopId: p.shopId || '',
  shopName: p.shop?.name || 'Unknown Shop',
  stock: p.stock,
  compatibleVehicles: (p.compatibleVehicles || []).map((v) =>
    typeof v === 'string' ? v : `${v.year} ${v.make} ${v.model}`
  ),
  rating: 0,
  reviewCount: 0,
  sku: p.sku || '',
  specifications: p.specifications,
  isActive: p.isActive,
});

interface AppState {
  // Vehicle
  userVehicle: Vehicle | null;
  setUserVehicle: (vehicle: Vehicle | null) => void;
  vehicleRefreshKey: number;
  triggerVehicleRefresh: () => void;
  
  // Cart
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  syncCartFromApi: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Vehicle
      userVehicle: null,
      setUserVehicle: (vehicle) => set({ userVehicle: vehicle }),
      vehicleRefreshKey: 0,
      triggerVehicleRefresh: () => set((state) => ({ vehicleRefreshKey: state.vehicleRefreshKey + 1 })),
      
      // Cart
      cart: [],
      addToCart: (product) =>
        set((state) => {
          const existing = state.cart.find((item) => item.product.id === product.id);
          if (existing) {
            // Sync to backend (fire and forget)
            api.addToCart({ productId: product.id, quantity: 1 }).catch(() => {});
            return {
              cart: state.cart.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          }
          api.addToCart({ productId: product.id, quantity: 1 }).catch(() => {});
          return { cart: [...state.cart, { product, quantity: 1 }] };
        }),
      removeFromCart: (productId) =>
        set((state) => {
          api.removeFromCart(productId).catch(() => {});
          return {
            cart: state.cart.filter((item) => item.product.id !== productId),
          };
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => {
          api.updateCartItem(productId, quantity).catch(() => {
            // Keep local state aligned with server when optimistic update fails.
            get().syncCartFromApi().catch(() => {});
          });
          return {
            cart: state.cart.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item
            ),
          };
        }),
      clearCart: () => {
        api.clearCart().catch(() => {});
        set({ cart: [] });
      },
      getCartTotal: () =>
        get().cart.reduce((total, item) => total + item.product.price * item.quantity, 0),
      getCartCount: () =>
        get().cart.reduce((count, item) => count + item.quantity, 0),
      syncCartFromApi: async () => {
        try {
          const { cart: apiCart } = await api.getCart();
          const items: CartItem[] = (apiCart.items || [])
            .filter((item: ApiCartItem) => typeof item.product === 'object' && item.product !== null)
            .map((item: ApiCartItem) => ({
              product: mapApiProductToProduct(item.product as ApiProduct),
              quantity: item.quantity,
            }));
          set({ cart: items });
        } catch {
          // If API call fails (e.g. not authenticated), keep existing cart
        }
      },
    }),
    {
      name: 'automatrix-storage',
      partialize: (state) => ({
        cart: state.cart,
        userVehicle: state.userVehicle,
      }),
    }
  )
);
