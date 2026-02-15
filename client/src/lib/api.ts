// API Client for Express Backend

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Types
export interface ApiProfile {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiUserRole {
  id: string;
  userId: string;
  role: 'customer' | 'admin' | 'superadmin';
}

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'admin' | 'superadmin';
  avatarUrl?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  createdAt: string;
  // Extended properties returned by getCurrentUser
  profile?: ApiProfile;
  userRoles?: ApiUserRole[];
  shop?: ApiShop;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiShop {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  ownerId: string;
  status: 'pending' | 'approved' | 'active' | 'suspended' | 'rejected';
  email?: string;
  phone?: string;
  address?: string;
  businessRegistration?: string;
  commissionRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  image_url?: string;
  image?: string;
  images?: string[];
  sku?: string;
  categoryId?: string;
  shopId: string;
  isActive: boolean;
  compatibleVariants?: string[];
  specifications?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  category?: ApiCategory;
  shop?: ApiShop;
}

export interface ApiCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  parentId?: string;
  created_at?: string;
}

export interface ApiOrder {
  id: string;
  customerId: string;
  shopId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  shippingAddress: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  trackingNumber?: string;
  notes?: string;
  stripePaymentId?: string;
  couponId?: string;
  discountAmount?: number;
  commissionAmount?: number;
  createdAt: string;
  updatedAt: string;
  items?: ApiOrderItem[];
  customer?: ApiUser;
  shop?: ApiShop;
}

export interface ApiOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: ApiProduct;
}

export interface ApiCoupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
  shopId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiVehicleBrand {
  id: string;
  name: string;
  logoUrl?: string;
  created_at?: string;
}

export interface ApiVehicleModel {
  id: string;
  name: string;
  brandId: string;
  created_at?: string;
}

export interface ApiVehicleVariant {
  id: string;
  name: string;
  modelId: string;
  yearStart: number;
  yearEnd?: number;
  created_at?: string;
}

export interface ApiUserVehicle {
  id: string;
  userId: string;
  brandId: string;
  modelId: string;
  variantId?: string;
  year: number;
  nickname?: string;
  vin?: string;
  isActive: boolean;
  brand?: ApiVehicleBrand;
  model?: ApiVehicleModel;
  variant?: ApiVehicleVariant;
  createdAt?: string;
}

export interface ApiReview {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user?: ApiUser;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface StockCheckResult {
  productId: string;
  name: string;
  available: number;
  requested: number;
  sufficient: boolean;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 - try token refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          throw new Error(await this.getErrorMessage(retryResponse));
        }
        return retryResponse.json();
      }
    }

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }

    return response.json();
  }

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data.message || data.error || 'An error occurred';
    } catch {
      return 'An error occurred';
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // ============ AUTH ============

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async registerSeller(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    shopName: string;
    shopDescription?: string;
    businessRegistration?: string;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register/seller', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async getCurrentUser(): Promise<ApiUser> {
    return this.request<ApiUser>('/auth/me');
  }

  async updateProfile(data: Partial<ApiUser>): Promise<ApiUser> {
    return this.request<ApiUser>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async resetPasswordWithSession(password: string): Promise<void> {
    await this.request('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // ============ PRODUCTS ============

  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    shopId?: string;
    shop?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: boolean;
  }): Promise<PaginatedResponse<ApiProduct>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          // Map frontend param names to backend
          const paramKey = key === 'categoryId' ? 'category' : key;
          searchParams.set(paramKey, String(value));
        }
      });
    }
    const response = await this.request<{
      products: ApiProduct[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/products?${searchParams.toString()}`);
    
    // Transform backend response to match PaginatedResponse
    return {
      data: response.products,
      total: response.pagination.total,
      page: response.pagination.page,
      limit: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
  }

  async getProduct(id: string): Promise<ApiProduct> {
    return this.request<ApiProduct>(`/products/${id}`);
  }

  async createProduct(data: Omit<ApiProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiProduct> {
    return this.request<ApiProduct>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: Partial<ApiProduct>): Promise<ApiProduct> {
    return this.request<ApiProduct>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.request(`/products/${id}`, { method: 'DELETE' });
  }

  async checkStock(items: { productId: string; quantity: number }[]): Promise<StockCheckResult[]> {
    return this.request<StockCheckResult[]>('/products/check-stock', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // ============ CATEGORIES ============

  async getCategories(): Promise<ApiCategory[]> {
    return this.request<ApiCategory[]>('/categories');
  }

  async getCategory(id: string): Promise<ApiCategory> {
    return this.request<ApiCategory>(`/categories/${id}`);
  }

  async createCategory(data: Omit<ApiCategory, 'id'>): Promise<ApiCategory> {
    return this.request<ApiCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: Partial<ApiCategory>): Promise<ApiCategory> {
    return this.request<ApiCategory>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request(`/categories/${id}`, { method: 'DELETE' });
  }

  // ============ ORDERS ============

  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    shopId?: string;
  }): Promise<PaginatedResponse<ApiOrder>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const response = await this.request<{
      orders: ApiOrder[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/orders?${searchParams.toString()}`);
    
    // Transform backend response to match PaginatedResponse
    return {
      data: response.orders,
      total: response.pagination.total,
      page: response.pagination.page,
      limit: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
  }

  async getMyOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<ApiOrder>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<ApiOrder>>(
      `/orders/my?${searchParams.toString()}`
    );
  }

  async getOrder(id: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/orders/${id}`);
  }

  async createOrder(data: {
    items: { productId: string; quantity: number }[];
    shippingAddress: string;
    shippingCity: string;
    shippingPostalCode: string;
    shopId: string;
    couponCode?: string;
    notes?: string;
  }): Promise<ApiOrder> {
    return this.request<ApiOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrderStatus(id: string, status: string, trackingNumber?: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, trackingNumber }),
    });
  }

  async updateOrderTracking(id: string, trackingNumber: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/orders/${id}/tracking`, {
      method: 'PUT',
      body: JSON.stringify({ trackingNumber }),
    });
  }

  // ============ SHOPS ============

  async getShops(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<ApiShop>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const response = await this.request<{
      shops: ApiShop[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/shops?${searchParams.toString()}`);
    
    // Transform backend response to match PaginatedResponse
    return {
      data: response.shops,
      total: response.pagination.total,
      page: response.pagination.page,
      limit: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
  }

  async getAllShops(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<ApiShop>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const response = await this.request<{
      shops: ApiShop[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/shops/all?${searchParams.toString()}`);
    
    return {
      data: response.shops,
      total: response.pagination.total,
      page: response.pagination.page,
      limit: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
  }

  async getShop(id: string): Promise<ApiShop> {
    return this.request<ApiShop>(`/shops/${id}`);
  }

  async getMyShop(): Promise<ApiShop> {
    return this.request<ApiShop>('/shops/my');
  }

  async updateShop(id: string, data: Partial<ApiShop>): Promise<ApiShop> {
    return this.request<ApiShop>(`/shops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateMyShop(data: Partial<ApiShop>): Promise<ApiShop> {
    return this.request<ApiShop>('/shops/my', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateShopStatus(id: string, status: string): Promise<ApiShop> {
    return this.request<ApiShop>(`/shops/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async updateShopCommission(id: string, commissionRate: number): Promise<ApiShop> {
    return this.request<ApiShop>(`/shops/${id}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commissionRate }),
    });
  }

  async getShopOwnerProfile(userId: string): Promise<Profile | null> {
    try {
      return await this.request<Profile>(`/users/${userId}/profile`);
    } catch {
      return null;
    }
  }

  // ============ COUPONS ============

  async getCoupons(params?: {
    page?: number;
    limit?: number;
    shopId?: string;
  }): Promise<PaginatedResponse<ApiCoupon>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const response = await this.request<{
      coupons: ApiCoupon[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/coupons?${searchParams.toString()}`);
    
    // Transform backend response to match PaginatedResponse
    return {
      data: response.coupons,
      total: response.pagination.total,
      page: response.pagination.page,
      limit: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
  }

  async getCoupon(id: string): Promise<ApiCoupon> {
    return this.request<ApiCoupon>(`/coupons/${id}`);
  }

  async validateCoupon(code: string, orderTotal: number, shopId?: string): Promise<{
    valid: boolean;
    coupon?: ApiCoupon;
    discountAmount?: number;
    message?: string;
  }> {
    return this.request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, orderTotal, shopId }),
    });
  }

  async createCoupon(data: Omit<ApiCoupon, 'id' | 'usedCount'>): Promise<ApiCoupon> {
    return this.request<ApiCoupon>('/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCoupon(id: string, data: Partial<ApiCoupon>): Promise<ApiCoupon> {
    return this.request<ApiCoupon>(`/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.request(`/coupons/${id}`, { method: 'DELETE' });
  }

  // ============ VEHICLES ============

  async getVehicleBrands(): Promise<ApiVehicleBrand[]> {
    return this.request<ApiVehicleBrand[]>('/vehicles/brands');
  }

  async getVehicleModels(brandId: string): Promise<ApiVehicleModel[]> {
    return this.request<ApiVehicleModel[]>(`/vehicles/models/${brandId}`);
  }

  async getAllVehicleModels(): Promise<ApiVehicleModel[]> {
    return this.request<ApiVehicleModel[]>('/vehicles/models/all');
  }

  async getVehicleVariants(modelId: string): Promise<ApiVehicleVariant[]> {
    return this.request<ApiVehicleVariant[]>(`/vehicles/variants/${modelId}`);
  }

  async getAllVehicleVariants(): Promise<ApiVehicleVariant[]> {
    return this.request<ApiVehicleVariant[]>('/vehicles/variants/all');
  }

  async createVehicleBrand(data: { name: string; logoUrl?: string }): Promise<ApiVehicleBrand> {
    return this.request<ApiVehicleBrand>('/vehicles/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVehicleBrand(id: string, data: { name?: string; logoUrl?: string }): Promise<ApiVehicleBrand> {
    return this.request<ApiVehicleBrand>(`/vehicles/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVehicleBrand(id: string): Promise<void> {
    await this.request(`/vehicles/brands/${id}`, { method: 'DELETE' });
  }

  async createVehicleModel(data: { name: string; brandId: string }): Promise<ApiVehicleModel> {
    return this.request<ApiVehicleModel>('/vehicles/models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVehicleModel(id: string, data: { name?: string; brandId?: string }): Promise<ApiVehicleModel> {
    return this.request<ApiVehicleModel>(`/vehicles/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVehicleModel(id: string): Promise<void> {
    await this.request(`/vehicles/models/${id}`, { method: 'DELETE' });
  }

  async createVehicleVariant(data: {
    name: string;
    modelId: string;
    yearStart: number;
    yearEnd?: number;
  }): Promise<ApiVehicleVariant> {
    return this.request<ApiVehicleVariant>('/vehicles/variants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVehicleVariant(id: string, data: {
    name?: string;
    modelId?: string;
    yearStart?: number;
    yearEnd?: number;
  }): Promise<ApiVehicleVariant> {
    return this.request<ApiVehicleVariant>(`/vehicles/variants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ============ USER VEHICLES ============

  async getUserVehicles(): Promise<ApiUserVehicle[]> {
    return this.request<ApiUserVehicle[]>('/vehicles/user');
  }

  async addUserVehicle(data: {
    brandId: string;
    modelId: string;
    variantId?: string;
    year: number;
    nickname?: string;
    vin?: string;
  }): Promise<ApiUserVehicle> {
    return this.request<ApiUserVehicle>('/vehicles/user', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async setActiveVehicle(vehicleId: string): Promise<void> {
    await this.request(`/vehicles/user/${vehicleId}/active`, {
      method: 'PUT',
    });
  }

  async deleteUserVehicle(vehicleId: string): Promise<void> {
    await this.request(`/vehicles/user/${vehicleId}`, { method: 'DELETE' });
  }

  async deleteVehicleVariant(id: string): Promise<void> {
    await this.request(`/vehicles/variants/${id}`, { method: 'DELETE' });
  }

  // ============ REVIEWS ============

  async getProductReviews(productId: string): Promise<ApiReview[]> {
    return this.request<ApiReview[]>(`/products/${productId}/reviews`);
  }

  async createReview(productId: string, data: { rating: number; comment?: string }): Promise<ApiReview> {
    return this.request<ApiReview>(`/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createProductReview(productId: string, data: { rating: number; comment?: string }): Promise<ApiReview> {
    return this.createReview(productId, data);
  }

  async deleteReview(productId: string, reviewId: string): Promise<void> {
    await this.request(`/products/${productId}/reviews/${reviewId}`, { method: 'DELETE' });
  }

  // ============ CHECKOUT ============

  async createCheckoutSession(data: {
    items: { productId: string; quantity: number }[];
    shippingAddress: string;
    shippingCity: string;
    shippingPostalCode: string;
    shopId: string;
    couponCode?: string;
  }): Promise<{ sessionId: string; url: string }> {
    return this.request<{ sessionId: string; url: string }>(
      '/checkout/create-session',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  // ============ FILE UPLOAD ============

  async uploadFile(file: File, type: string = 'products'): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload?type=${type}`, {
      method: 'POST',
      headers: {
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }

    const result = await response.json();
    return result.url;
  }

  async uploadMultipleFiles(files: File[], type: string = 'products'): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE}/upload/multiple?type=${type}`, {
      method: 'POST',
      headers: {
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }

    const result = await response.json();
    return result.files.map((f: { url: string }) => f.url);
  }
}

export const api = new ApiClient();
