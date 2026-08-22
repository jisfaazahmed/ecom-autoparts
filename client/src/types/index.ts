export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  registrationNumber?: string;
  vin?: string;
  brandId?: string;
  modelId?: string;
  variantId?: string;
  variant?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  images?: string[];
  category: string;
  categoryId?: string;
  brand: string;
  shopId: string;
  shopName: string;
  stock: number;
  compatibleVehicles: string[];
  rating: number;
  reviewCount: number;
  sku: string;
  specifications?: Record<string, string>;
  isActive?: boolean;
  originalPrice?: number;
  effectiveDiscountPercent?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Shop {
  id: string;
  name: string;
  logo: string;
  description: string;
  ownerId: string;
  status: 'pending' | 'approved' | 'rejected';
  commissionRate: number;
  totalSales?: number;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName?: string;
  shopId: string;
  items: OrderItem[];
  total: number;
  totalAmount?: number;
  commissionAmount?: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  createdAt: string;
  trackingNumber?: string;
  notes?: string;
}

export interface OrderItem {
  id?: string;
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  product?: Product;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'superadmin';
  vehicle?: Vehicle;
  shopId?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  productCount?: number;
}

export interface VehicleBrand {
  id: string;
  name: string;
  logoUrl?: string;
  models?: VehicleModel[];
}

export interface VehicleModel {
  id: string;
  name: string;
  brandId?: string;
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  avatarUrl?: string;
}
