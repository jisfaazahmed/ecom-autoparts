/* eslint-disable @typescript-eslint/no-explicit-any */
// API Client for Express Backend

// Relative by default: in production nginx proxies /api to the server container
// (client/nginx.conf) and in development vite.config.ts proxies it to :5000, so the
// same-origin path works in both. Because Vite inlines VITE_* at build time, a
// relative default also means changing domain or host needs no rebuild.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
  status?: string;
  shopName?: string;
  commissionRate?: number;
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

export interface ApiAddress {
  _id: string;
  user: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  addressType: 'home' | 'office' | 'other';
  createdAt?: string;
  updatedAt?: string;
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
  shopWideDiscountPercent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
  resetLink?: string;
}

export interface ApiCompatibleVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
}

export interface ApiCompatibleModel {
  id: string;
  name: string;
  brandId?: string;
  brandName?: string;
}

export interface ApiProduct {
  _id?: string;
  id: string;
  name: string;
  description?: string;
  price: number;
  weight?: number;
  stock: number;
  imageUrl?: string;
  image_url?: string;
  image?: string;
  images?: string[];
  sku?: string;
  categoryId?: string;
  shopId: string;
  isActive: boolean;
  compatibleVehicles?: ApiCompatibleVehicle[];
  compatibleVehicleModels?: ApiCompatibleModel[];
  status?: "Pending" | "Approved" | "Rejected";
  featured?: boolean;
  hasDiscount?: boolean;
  originalPrice?: number;
  productDiscountPercent?: number;
  shopDiscountPercent?: number;
  effectiveDiscountPercent?: number;
  compatibleVariants?: string[];
  specifications?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  category?: ApiCategory;
  shop?: ApiShop;
  rating?: number;
  reviewCount?: number;
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
  _id?: string;
  orderNumber?: string;
  customerId: string;
  shopId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  overallStatus?: string;
  paymentStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  paymentMethod?: string;
  totalAmount: number;
  shippingAddress: string | { fullName: string; phone: string; addressLine1: string; city?: string; state?: string; postalCode?: string };
  shippingCity?: string;
  shippingPostalCode?: string;
  trackingNumber?: string;
  deliveryConfirmation?: {
    confirmed?: boolean;
    confirmedAt?: string;
    note?: string | null;
  };
  estimatedDeliveryDate?: string;
  notes?: string;
  stripePaymentId?: string;
  stripeSessionId?: string;
  transactionId?: string;
  guestInvoiceToken?: string;
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
  _id?: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: ApiProduct;
  status?: string;
  vendor?: string;
}

export interface ApiCartItem {
  product: string | ApiProduct;
  quantity: number;
  price: number;
  _id?: string;
}

export interface ApiCart {
  _id?: string;
  user: string;
  items: ApiCartItem[];
  totalItems: number;
  totalPrice: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiCoupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed' | 'fixed_amount';
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
  brand?: ApiVehicleBrand;
}



export interface ApiVehicleVariant {
  id: string;
  name: string;
  modelId: string;
  variantId?: string;
  variant?: ApiVehicleVariant;
  yearStart: number;
  yearEnd?: number;
  engine?: string;
  created_at?: string;
}

export interface ApiResolvedVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  submodel?: string;
}

export interface ApiUserVehicle {
  id: string;
  userId: string;
  brandId: string;
  modelId: string;
  year: number;
  registrationNumber?: string;
  nickname?: string;
  vin?: string;
  isActive: boolean;
  brand?: ApiVehicleBrand;
  model?: ApiVehicleModel;
  createdAt?: string;
}

export interface ApiRegCheckVehicle {
  registrationNumber: string;
  brand: ApiVehicleBrand;
  model: { id: string; name: string };
  year: number | null;
}

export type ApiRegCheckResult =
  | { found: true; vehicle: ApiRegCheckVehicle }
  | { found: false; message: string };

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

export interface StartRegisterResponse {
  message: string;
  verificationId: string;
  expiresInMinutes?: number;
}

export interface StockCheckResult {
  productId: string;
  name: string;
  available: number;
  requested: number;
  sufficient: boolean;
}

export interface ApiNotification {
  _id: string;
  user: string;
  type: string;
  title: string;
  message: string;
  data?: {
    orderNumber?: string;
    trackingNumber?: string;
    courierPartner?: string;
    refundAmount?: number;
    paymentMethod?: string;
    reason?: string;
  };
  priority: 'low' | 'normal' | 'high';
  channel: 'in_app' | 'email' | 'sms' | 'push';
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiNotificationListResponse {
  notifications: ApiNotification[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiStockSummary {
  totalStock: number;
  reserved: number;
  available: number;
  reservationCount: number;
}

export interface ApiOrderTimelineEvent {
  event: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface ShippingCalculationRequest {
  items: Array<{
    product: {
      price: number;
      weight?: number;
    };
    quantity: number;
  }>;
  deliveryAddress: {
    district: string;
    city?: string;
  };
  shippingMethod?: 'standard' | 'express' | 'same_day';
}

export interface ShippingCalculationResponse {
  baseCharge: number;
  weightCharge: number;
  zoneCharge: number;
  totalCharge: number;
  freeShipping: boolean;
  weight: number;
  zone: string;
  estimatedDays: {
    min: number;
    max: number;
  };
}

export interface ApiRefund {
  _id?: string;
  id?: string;
  order?: string;
  orderItem?: string;
  payment?: string;
  amount?: number;
  vendor?: {
    _id?: string;
    name?: string;
    email?: string;
    shopName?: string;
  };
  requestNumber?: string;
  status: string;
  refundType?: string;
  refundTransactionId?: string;
  returnStatus?: 'pending' | 'picked' | 'received' | 'not_required';
  returnReason?: {
    category?: string;
    description?: string;
  };
  product?: {
    name?: string;
    quantity?: number;
    totalAmount?: number;
  };
  refundAmount?: {
    totalRefund?: number;
    currency?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiRefundListResponse {
  refunds: ApiRefund[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type ApiSettlementStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ApiSettlement {
  _id: string;
  settlementPeriod: {
    startDate: string;
    endDate: string;
  };
  ordersSummary: {
    totalOrders: number;
    totalOrderAmount: number;
    totalRefunded: number;
    netOrderAmount: number;
  };
  commission: {
    rate: number;
    totalCommission: number;
  };
  charges: {
    platformFee: number;
    paymentProcessingFee: number;
    logisticsFee: number;
    otherCharges: number;
    totalCharges: number;
  };
  payableAmount: number;
  status: ApiSettlementStatus;
  payoutMethod?: string;
  payoutDetails?: {
    transactionId?: string;
    payoutDate?: string;
    confirmationDate?: string;
    failureReason?: string;
    referenceNumber?: string;
  };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiSettlementListResponse {
  settlements: ApiSettlement[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    perPage: number;
  };
}

export interface ApiEarningsBreakdown {
  byCategory: Array<{
    category: string | null;
    earnings: number;
    orders: number;
  }>;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage (handling different keys based on auth)
    this.accessToken = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  getToken(): string | null {
    // Ensure we always return the latest token directly from storage
    return localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
  }

  private mapVendorStatusToShopStatus(status?: string): ApiShop['status'] {
    const normalized = String(status || '').toUpperCase();
    switch (normalized) {
      case 'ACTIVE':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'SUSPENDED':
        return 'suspended';
      case 'PENDING':
      default:
        return 'pending';
    }
  }

  private mapShopStatusToVendorStatus(status?: string): string | undefined {
    switch (status) {
      case 'approved':
      case 'active':
        return 'ACTIVE';
      case 'rejected':
        return 'REJECTED';
      case 'suspended':
        return 'SUSPENDED';
      case 'pending':
        return 'PENDING';
      default:
        return undefined;
    }
  }

  private mapVendorToShop(vendor: any): ApiShop {
    const id = vendor?.id || vendor?._id || '';
    const createdAt = vendor?.createdAt || vendor?.created_at || new Date().toISOString();
    return {
      id,
      name: vendor?.shopName || vendor?.name || 'Unnamed Shop',
      description: vendor?.description ?? null,
      logoUrl: vendor?.logoUrl ?? undefined,
      ownerId: vendor?.ownerId || vendor?._id || vendor?.id || '',
      status: this.mapVendorStatusToShopStatus(vendor?.status),
      email: vendor?.email ?? undefined,
      phone: vendor?.phone ?? undefined,
      address: vendor?.address ?? undefined,
      businessRegistration: vendor?.businessRegistration || vendor?.businessRegistrationNumber || undefined,
      commissionRate: vendor?.commissionRate ?? 10,
      shopWideDiscountPercent: vendor?.shopWideDiscountPercent ?? 0,
      createdAt,
      updatedAt: vendor?.updatedAt || vendor?.updated_at || createdAt,
    };
  }

  private normalizeOrderItem(item: any): ApiOrderItem {
    return {
      ...item,
      id: item?.id || item?._id || '',
      _id: item?._id,
      orderId: item?.orderId || item?.order || '',
      productId: item?.productId || item?.product?._id || item?.product || '',
      productName: item?.productName || item?.name || item?.product?.name || '',
      unitPrice: item?.unitPrice ?? item?.price ?? 0,
      totalPrice: item?.totalPrice ?? item?.finalPrice ?? ((item?.price || 0) * (item?.quantity || 0)),
    };
  }

  private normalizeOrder(order: any): ApiOrder {
    const items = Array.isArray(order?.items)
      ? order.items.map((item: any) => this.normalizeOrderItem(item))
      : undefined;

    const normalizedStatus =
      order?.status ||
      order?.subOrder?.status ||
      order?.overallStatus ||
      'pending';

    return {
      ...order,
      id: order?.id || order?._id || '',
      _id: order?._id,
      status: normalizedStatus,
      items,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error(
        'Cannot reach the API. Use http://localhost:3000 and ensure Docker services (client + server) are running.'
      );
    }

    if (response.status === 401) {
      if (this.refreshToken) {
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

      this.clearAuthStorage();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }

    // 204 No Content has no body - do not parse as JSON
    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return await response.json();
    } catch {
      throw new Error('Invalid JSON response from server');
    }
  }

  private async getErrorMessage(response: Response): Promise<string> {
    const raw = await response.text();
    if (!raw) return `Request failed (${response.status})`;
    try {
      const data = JSON.parse(raw);
      return data.message || data.error || `Request failed (${response.status})`;
    } catch {
      return raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
    }
  }

  private clearAuthStorage() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        this.clearAuthStorage();
        return false;
      }

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      this.clearAuthStorage();
      return false;
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  logout() {
    this.clearAuthStorage();
  }

  isAuthenticated(): boolean {
    return !!(this.getToken());
  }

  // ============ AUTH ============

  async login(email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async startRegister(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    address?: string;
  }): Promise<StartRegisterResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();
    return this.request<StartRegisterResponse>('/auth/register/start', {
      method: 'POST',
      body: JSON.stringify({
        name: data.fullName,
        email: normalizedEmail,
        password: data.password,
        role: 'CUSTOMER',
        phone: data.phone?.trim() || undefined,
        address: data.address?.trim() || undefined,
      }),
    });
  }

  async startRegisterSeller(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    address?: string;
    shopName: string;
    shopDescription?: string;
    businessRegistration?: string;
  }): Promise<StartRegisterResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();
    return this.request<StartRegisterResponse>('/auth/register/start', {
      method: 'POST',
      body: JSON.stringify({
        name: data.fullName,
        email: normalizedEmail,
        password: data.password,
        role: 'ADMIN',
        shopName: data.shopName,
        phone: data.phone?.trim() || undefined,
        address: data.address?.trim() || undefined,
      }),
    });
  }

  async verifyRegisterOtp(data: { verificationId: string; otp: string }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async resendRegisterOtp(data: { verificationId: string }): Promise<StartRegisterResponse> {
    return this.request<StartRegisterResponse>('/auth/register/resend', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Backward-compatible wrappers: perform start phase only
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<any> {
    return this.startRegister(data);
  }

  async registerSeller(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    address?: string;
    shopName: string;
    shopDescription?: string;
    businessRegistration?: string;
  }): Promise<any> {
    return this.startRegisterSeller(data);
  }

  async getCurrentUser(): Promise<ApiUser> {
    return this.request<ApiUser>('/auth/me');
  }

  async getMyProfile(): Promise<any> {
    return this.request<any>('/users/profile');
  }

  async updateProfile(data: Partial<ApiUser>): Promise<ApiUser> {
    return this.request<ApiUser>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, passwordConfirm: newPassword }),
    });
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return this.request<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string, passwordConfirm: string): Promise<void> {
    await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, passwordConfirm }),
    });
  }

  async resetPasswordWithSession(password: string): Promise<void> {
    await this.request('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async verifyEmail(token: string): Promise<{ message: string; emailVerified: boolean }> {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    return this.request('/auth/resend-verification-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // ============ ADDRESSES ============

  async getAddresses(): Promise<ApiAddress[]> {
    return this.request<ApiAddress[]>('/addresses');
  }

  async createAddress(data: Omit<ApiAddress, '_id' | 'user' | 'createdAt' | 'updatedAt'>): Promise<{ message: string; address: ApiAddress }> {
    return this.request<{ message: string; address: ApiAddress }>('/addresses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAddress(id: string, data: Partial<ApiAddress>): Promise<{ message: string; address: ApiAddress }> {
    return this.request<{ message: string; address: ApiAddress }>(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAddress(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/addresses/${id}`, { method: 'DELETE' });
  }

  // ============ PRODUCTS ============

  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    shopId?: string;
    shop?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: boolean;
    make?: string;
    model?: string;
    vehicleId?: string;
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
    const response = await this.request<any>(`/products?${searchParams.toString()}`);

    // Transform backend response to match PaginatedResponse
    // It might be a plain array or { products: [], pagination: {} }
    const data = Array.isArray(response) ? response : (response.products || response.data || []);
    const pagination = response.pagination || {};

    return {
      data: data,
      total: pagination.total || data.length || 0,
      page: pagination.page || 1,
      limit: pagination.limit || data.length || 10,
      totalPages: pagination.totalPages || 1,
    };
  }

  async getSuperAdminProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    status?: string;
    vehicleId?: string;
  }): Promise<PaginatedResponse<ApiProduct>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          const paramKey = key === 'categoryId' ? 'category' : key;
          searchParams.set(paramKey, String(value));
        }
      });
    }

    const response = await this.request<any>(`/products/admin/all?${searchParams.toString()}`);
    const data = Array.isArray(response) ? response : (response.products || response.data || []);
    const pagination = response.pagination || {};

    return {
      data,
      total: pagination.total || data.length || 0,
      page: pagination.page || 1,
      limit: pagination.limit || data.length || 10,
      totalPages: pagination.totalPages || 1,
    };
  }

  async getProduct(id: string): Promise<ApiProduct> {
    return this.request<ApiProduct>(`/products/${id}`);
  }

  async getFeaturedProducts(): Promise<ApiProduct[]> {
    const response = await this.request<any>('/products/featured');
    return Array.isArray(response) ? response : (response.products || response.data || []);
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

  async updateProductStatus(id: string, status: "Pending" | "Approved" | "Rejected"): Promise<ApiProduct> {
    return this.request<ApiProduct>(`/products/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async updateProductFeatured(id: string, featured: boolean): Promise<ApiProduct> {
    return this.request<ApiProduct>(`/products/${id}/featured`, {
      method: 'PUT',
      body: JSON.stringify({ featured }),
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
  }): Promise<PaginatedResponse<ApiOrder>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    // Backend route is /orders/my_orders and wraps data in { success, data: { orders, pagination } }
    const response = await this.request<{
      success: boolean;
      data: {
        orders: ApiOrder[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>(`/orders/my_orders?${searchParams.toString()}`);
    const payload = response.data || { orders: [], pagination: { page: 1, limit: 10, total: 0, pages: 1 } };

    return {
      data: (payload.orders || []).map((order) => this.normalizeOrder(order)),
      total: payload.pagination.total,
      page: payload.pagination.page,
      limit: payload.pagination.limit,
      totalPages: payload.pagination.pages,
    };
  }

  async getPlatformOrders(params?: {
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

    const response = await this.request<{
      success: boolean;
      data: {
        orders: ApiOrder[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>(`/orders/admin/all?${searchParams.toString()}`);

    const payload = response.data || { orders: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } };

    return {
      data: (payload.orders || []).map((order) => this.normalizeOrder(order)),
      total: payload.pagination.total,
      page: payload.pagination.page,
      limit: payload.pagination.limit,
      totalPages: payload.pagination.pages,
    };
  }

  async getVendorOrders(params?: {
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

    const response = await this.request<{
      success: boolean;
      data: {
        orders: ApiOrder[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>(`/orders/seller/orders?${searchParams.toString()}`);

    const payload = response.data || { orders: [], pagination: { page: 1, limit: 10, total: 0, pages: 1 } };

    return {
      data: (payload.orders || []).map((order) => this.normalizeOrder(order)),
      total: payload.pagination.total,
      page: payload.pagination.page,
      limit: payload.pagination.limit,
      totalPages: payload.pagination.pages,
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
    const response = await this.request<any>(`/orders/my_orders?${searchParams.toString()}`);

    // Legacy format support: { data, total, page, limit, totalPages }
    if (Array.isArray(response?.data)) {
      return {
        data: response.data.map((order: any) => this.normalizeOrder(order)),
        total: response.total || 0,
        page: response.page || 1,
        limit: response.limit || params?.limit || 10,
        totalPages: response.totalPages || 1,
      };
    }

    // Current backend format: { success, data: { orders, pagination } }
    const orders = (response?.data?.orders || []).map((order: any) => this.normalizeOrder(order));
    const pagination = response?.data?.pagination || {};

    return {
      data: orders,
      total: pagination.total || orders.length,
      page: pagination.page || 1,
      limit: pagination.limit || params?.limit || 10,
      totalPages: pagination.pages || 1,
    };
  }

  async getOrder(id: string): Promise<ApiOrder> {
    const response = await this.request<any>(`/orders/${id}`);
    const rawOrder = response?.order || response;
    return this.normalizeOrder(rawOrder);
  }

  async getOrderWithTimeline(id: string): Promise<{
    order: ApiOrder;
    timeline: ApiOrderTimelineEvent[];
  }> {
    const response = await this.request<any>(`/orders/${id}`);
    return {
      order: this.normalizeOrder(response?.order || response),
      timeline: response?.timeline || [],
    };
  }

  async downloadInvoice(orderId: string, options?: { guestToken?: string }): Promise<boolean> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    const guestToken = options?.guestToken;

    if (guestToken) {
      headers['x-guest-invoice-token'] = guestToken;
    } else if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const endpoint = guestToken
      ? `${API_BASE}/orders/${orderId}/invoice/guest`
      : `${API_BASE}/orders/${orderId}/invoice`;

    const resp = await fetch(endpoint, {
      method: 'GET',
      headers,
    });

    if (!resp.ok) {
      let message = 'Failed to download invoice';
      try {
        const data = await resp.json();
        message = data.message || message;
      } catch (_parseError) {
        const fallbackText = await resp.text().catch(() => '');
        if (fallbackText) {
          message = fallbackText;
        }
      }
      throw new Error(message);
    }

    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  }

  async createOrder(data: {
    items: { productId: string; quantity: number }[];
    shippingAddress: string;
    shippingCity: string;
    shippingPostalCode: string;
    fullName?: string;
    phone?: string;
    shippingCountry?: string;
    paymentMethod?: 'cod' | 'card' | 'wallet' | 'bank_transfer' | 'installment';
    shopId?: string;
    couponCode?: string;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<ApiOrder> {
    const { idempotencyKey, ...payload } = data;
    const response = await this.request<ApiOrder | { order?: ApiOrder; data?: ApiOrder; guestInvoiceToken?: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });

    const rawOrder = (response as any)?.order || (response as any)?.data || response;
    const normalizedOrder = this.normalizeOrder(rawOrder);
    const guestInvoiceToken = (response as any)?.guestInvoiceToken;
    if (guestInvoiceToken) {
      normalizedOrder.guestInvoiceToken = guestInvoiceToken;
    }
    return normalizedOrder;
  }

  async updateOrderStatus(id: string, status: string, trackingNumber?: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, trackingNumber }),
    });
  }

  async updateOrderItemStatus(orderId: string, itemId: string, status: string, note?: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/orders/${orderId}/item-status`, {
      method: 'PATCH',
      body: JSON.stringify({ id: itemId, status, note }),
    });
  }

  async updateOrderTracking(id: string, trackingNumber: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/orders/${id}/tracking`, {
      method: 'PUT',
      body: JSON.stringify({ trackingNumber }),
    });
  }

  async cancelOrder(id: string, reason?: string): Promise<{ message: string; data: ApiOrder }> {
    return this.request<{ message: string; data: ApiOrder }>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async confirmOrderReceipt(id: string, note?: string): Promise<{ message: string; data: ApiOrder }> {
    return this.request<{ message: string; data: ApiOrder }>(`/orders/${id}/confirm-receipt`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async trackOrder(trackingNumber: string): Promise<{
    order: ApiOrder;
    timeline: Array<{
      event: string;
      title: string;
      description?: string;
      createdAt: string;
    }>;
  }> {
    return this.request(`/orders/track/${trackingNumber}`);
  }

  async recoverGuestOrders(email: string): Promise<{ message: string; orders: ApiOrder[] }> {
    return this.request<{ message: string; orders: ApiOrder[] }>('/orders/recover-guest', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // ============ SHIPPING ============

  async calculateShipping(data: ShippingCalculationRequest): Promise<ShippingCalculationResponse> {
    return this.request<ShippingCalculationResponse>('/shipping/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ CART ============

  async getCart(): Promise<{ success: boolean; cart: ApiCart }> {
    return this.request('/cart');
  }

  async addToCart(data: { productId: string; quantity: number }): Promise<{ success: boolean; message: string; cart: ApiCart }> {
    return this.request('/cart', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCartItem(productId: string, quantity: number): Promise<{ success: boolean; message: string; cart: ApiCart }> {
    return this.request(`/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeFromCart(productId: string): Promise<{ success: boolean; message: string; cart: ApiCart }> {
    return this.request(`/cart/${productId}`, {
      method: 'DELETE',
    });
  }

  async clearCart(): Promise<{ success: boolean; message: string; cart: ApiCart }> {
    return this.request('/cart', {
      method: 'DELETE',
    });
  }

  async reorder(orderId: string): Promise<{ message: string }> {
    const order = await this.getOrder(orderId);

    // Add all order items to cart
    for (const item of order.items || []) {
      await this.addToCart({
        productId: item.productId,
        quantity: item.quantity,
      });
    }

    return { message: 'Items added to cart successfully' };
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
    // Call consolidated /api/shops endpoint instead of /api/vendors
    const response = await this.request<{ shops: any[]; pagination: any }>(`/shops?${searchParams.toString()}`);
    const shops = Array.isArray(response?.shops) ? response.shops : [];
    return {
      data: shops,
      total: response?.pagination?.total || shops.length,
      page: response?.pagination?.page || 1,
      limit: response?.pagination?.limit || shops.length,
      totalPages: response?.pagination?.totalPages || 1,
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
    // Call consolidated /api/shops endpoint instead of /api/vendors
    const response = await this.request<{ shops: any[]; pagination: any }>(`/shops?${searchParams.toString()}`);
    const shops = Array.isArray(response?.shops) ? response.shops : [];
    return {
      data: shops,
      total: response?.pagination?.total || shops.length,
      page: response?.pagination?.page || 1,
      limit: response?.pagination?.limit || shops.length,
      totalPages: response?.pagination?.totalPages || 1,
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
    // Call consolidated /api/shops/:id/status endpoint (returns ApiShop directly)
    const response = await this.request<ApiShop>(`/shops/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (response) return response;
    return {
      id,
      name: 'Unnamed Shop',
      description: undefined,
      ownerId: id,
      status: 'pending' as const,
      email: undefined,
      phone: undefined,
      address: undefined,
      businessRegistration: undefined,
      logoUrl: undefined,
      commissionRate: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateShopCommission(id: string, commissionRate: number): Promise<ApiShop> {
    // Call consolidated /api/shops/:id/commission endpoint (returns ApiShop directly)
    const response = await this.request<ApiShop>(`/shops/${id}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commissionRate }),
    });
    if (response) return response;
    return {
      id,
      name: 'Unnamed Shop',
      description: undefined,
      ownerId: id,
      status: 'approved' as const,
      email: undefined,
      phone: undefined,
      address: undefined,
      businessRegistration: undefined,
      logoUrl: undefined,
      commissionRate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getShopOwnerProfile(userId: string): Promise<Profile | null> {
    try {
      return await this.request<Profile>(`/users/${userId}/profile`);
    } catch {
      return null;
    }
  }

  // ============ VENDOR ANALYTICS ============

  async getVendorAnalytics(vendorId: string, params?: {
    range?: '7d' | '30d' | '90d' | '1y';
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.range) searchParams.set('range', params.range);
    return this.request<any>(`/vendors/${vendorId}/analytics?${searchParams.toString()}`);
  }

  async getVendorTimeSeriesAnalytics(vendorId: string, params?: {
    range?: '7d' | '30d' | '90d' | '1y';
    granularity?: 'daily' | 'weekly' | 'monthly';
  }): Promise<{ timeSeries: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.range) searchParams.set('range', params.range);
    if (params?.granularity) searchParams.set('granularity', params.granularity);
    return this.request<{ timeSeries: any[] }>(`/vendors/${vendorId}/analytics/timeseries?${searchParams.toString()}`);
  }

  async getVendorEarningsBreakdown(vendorId: string, params?: {
    range?: '7d' | '30d' | '90d' | '1y';
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.range) searchParams.set('range', params.range);
    return this.request<any>(`/vendors/${vendorId}/analytics/earnings?${searchParams.toString()}`);
  }

  // ============ SYSTEM ANALYTICS ============

  async getSuperAdminAnalytics(params?: {
    range?: '7d' | '30d' | '90d' | '1y';
  }): Promise<{
    totalSales: number;
    totalCommission: number;
    totalOrders: number;
    totalVendors: number;
    aov: number;
    totalRefunds: number;
    topVendors: any[];
    ordersByStatus: Record<string, number>;
    salesByMonth: Array<{ month: string; sales: number; commission: number; orders: number }>;
    topCategories: Array<{ categoryId: string; earnings: number }>;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.range) searchParams.set('range', params.range);
    const response = await this.request<{ success: boolean; data: any } & Record<string, unknown>>(
      `/admin-analytics/superadmin?${searchParams.toString()}`
    );
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data as {
        totalSales: number;
        totalCommission: number;
        totalOrders: number;
        totalVendors: number;
        ordersByStatus: Record<string, number>;
        salesByMonth: Array<{ month: string; sales: number; commission: number; orders: number }>;
        topCategories: Array<{ categoryId: string; earnings: number }>;
        topVendors?: Array<{ shopName: string; name: string; sales: number; orders: number }>;
        aov?: number;
        totalRefunds?: number;
      };
    }
    return response as any;
  }

  async askAnalyticsAI(
    question: string,
    analyticsData: any,
    dateRange: string
  ): Promise<{ answer: string }> {
    const response = await this.request<{ answer: string }>(
      '/admin-analytics/superadmin/ask',
      {
        method: 'POST',
        body: JSON.stringify({ question, analyticsData, dateRange })
      }
    );
    return response;
  }

  // ============ SETTLEMENT / PAYOUT ============

  async getSettlementSummary(vendorId: string): Promise<any> {
    return this.request<any>(`/vendors/${vendorId}/settlement/summary`);
  }

  async getVendorSettlements(vendorId: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    return this.request<any>(`/vendors/${vendorId}/settlements?${searchParams.toString()}`);
  }

  async getVendorSettlementRangeSummary(vendorId: string, params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ totalSettlements: number; totalCommission: number; totalPayable: number; totalOrderAmount: number; totalRefunded: number }> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    return this.request<{ totalSettlements: number; totalCommission: number; totalPayable: number; totalOrderAmount: number; totalRefunded: number }>(`/vendors/${vendorId}/settlements/summary?${searchParams.toString()}`);
  }

  async getSettlementDetails(settlementId: string): Promise<any> {
    return this.request<any>(`/settlements/${settlementId}`);
  }

  async getTotalPayable(vendorId: string): Promise<{ totalPayable: number; totalSettlements: number }> {
    return this.request<{ totalPayable: number; totalSettlements: number }>(`/vendors/${vendorId}/payable`);
  }

  // ---- Seller self-service (scoped to the logged-in seller, no vendorId) ----

  async getMySettlementSummary(): Promise<ApiSettlement> {
    return this.request<ApiSettlement>('/settlements/my/summary');
  }

  async getMySettlements(params?: {
    status?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiSettlementListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    return this.request<ApiSettlementListResponse>(`/settlements/my?${searchParams.toString()}`);
  }

  async getMyPayable(): Promise<{ totalPayable: number; totalSettlements: number }> {
    return this.request<{ totalPayable: number; totalSettlements: number }>('/settlements/my/payable');
  }

  async getMyEarningsBreakdown(range = '30d'): Promise<ApiEarningsBreakdown> {
    return this.request<ApiEarningsBreakdown>(`/settlements/my/earnings?range=${encodeURIComponent(range)}`);
  }

  async getMySettlementDetails(settlementId: string): Promise<ApiSettlement> {
    return this.request<ApiSettlement>(`/settlements/my/${settlementId}`);
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

  async getPublicActiveCoupons(limit = 20): Promise<ApiCoupon[]> {
    const response = await this.request<{ coupons: ApiCoupon[] }>(`/coupons/public/active?limit=${limit}`);
    return response?.coupons || [];
  }

  async createCoupon(data: Omit<ApiCoupon, 'id' | 'usedCount'>): Promise<ApiCoupon> {
    return this.request<ApiCoupon>('/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkCreateCoupons(data: Partial<ApiCoupon> & { count: number; prefix?: string }): Promise<{ count: number; coupons: ApiCoupon[] }> {
    return this.request<{ count: number; coupons: ApiCoupon[] }>('/coupons/bulk', {
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



  async resolveVehicle(params: {
    year: number;
    make: string;
    model: string;
    submodel?: string;
  }): Promise<ApiResolvedVehicle> {
    const searchParams = new URLSearchParams();
    searchParams.set('year', String(params.year));
    searchParams.set('make', params.make);
    searchParams.set('model', params.model);
    if (params.submodel) searchParams.set('submodel', params.submodel);
    return this.request<ApiResolvedVehicle>(`/vehicles/resolve?${searchParams.toString()}`);
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



  // ============ REGISTRATION LOOKUP ============

  async lookupRegistration(registrationNumber: string): Promise<ApiRegCheckResult> {
    return this.request<ApiRegCheckResult>(`/vehicles/lookup/${encodeURIComponent(registrationNumber)}`);
  }

  async addUserVehicleByReg(data: {
    registrationNumber: string;
    brandId: string;
    modelId: string;
    year?: number;
  }): Promise<ApiUserVehicle> {
    return this.request<ApiUserVehicle>('/vehicles/user/reg', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createVehicleVariant(data: {
    name: string;
    modelId: string;
    yearStart: number;
    yearEnd?: number;
    engine?: string;
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
    engine?: string;
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
    year: number;
    variantId?: string;
    registrationNumber?: string;
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

  async updateReview(productId: string, reviewId: string, data: { rating: number; comment?: string }): Promise<ApiReview> {
    return this.request<ApiReview>(`/products/${productId}/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReview(productId: string, reviewId: string): Promise<void> {
    await this.request(`/products/${productId}/reviews/${reviewId}`, { method: 'DELETE' });
  }

  // ============ CHECKOUT ============

  async createCheckoutSession(data: {
    orderId: string;
  }): Promise<{ sessionId: string; url: string }> {
    const response = await this.request<{ sessionId: string; url: string; data?: { sessionId: string; url: string } }>(
      '/payments/create-checkout-session',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    return response.data || response;
  }

  async createPaymentIntent(data: { orderId: string; email?: string; otp?: string }): Promise<{
    paymentIntentId?: string;
    clientSecret?: string;
    amount?: number;
    currency?: string;
    requiresAction?: boolean;
    nextAction?: any;
    requiresOtp?: boolean;
    expiresAt?: string;
    retryInSeconds?: number;
  }> {
    const response = await this.request<any>('/payments/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // The OTP gate answers 202 with the flag at the top level and the details
    // nested under `data`, so merge both rather than letting `data` shadow it.
    return { ...response, ...(response?.data || {}) };
  }

  async confirmPaymentIntent(data: { orderId: string; paymentIntentId: string; otp?: string; idempotencyKey?: string }): Promise<{
    orderId: string;
    paymentIntentId: string;
    paymentStatus: string;
    requiresAction?: boolean;
    retryCount?: number;
    retryEligible?: boolean;
    nextAction?: any;
  }> {
    const { idempotencyKey, ...payload } = data;
    const response = await this.request<{
      orderId: string;
      paymentIntentId: string;
      paymentStatus: string;
      requiresAction?: boolean;
      retryCount?: number;
      retryEligible?: boolean;
      nextAction?: any;
      data?: {
        orderId: string;
        paymentIntentId: string;
        paymentStatus: string;
        requiresAction?: boolean;
        retryCount?: number;
        retryEligible?: boolean;
        nextAction?: any;
      };
    }>('/payments/confirm-payment-intent', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });

    return response.data || response;
  }

  async retryPaymentIntent(data: { orderId: string; paymentIntentId: string; otp?: string }): Promise<{
    orderId: string;
    paymentIntentId: string;
    paymentStatus: string;
    requiresAction?: boolean;
    retryCount?: number;
    retryEligible?: boolean;
    nextAction?: any;
  }> {
    const response = await this.request<any>('/payments/retry-payment-intent', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return response.data || response;
  }

  async getWalletBalance(): Promise<{ balance: number }> {
    const response = await this.request<any>('/payments/wallet/balance');
    return response.data || response;
  }

  async payWithWallet(data: { orderId: string; otp?: string }): Promise<{
    orderId?: string;
    paymentId?: string;
    paymentStatus?: string;
    balance?: number;
    requiresOtp?: boolean;
    expiresAt?: string;
  }> {
    const response = await this.request<any>('/payments/wallet/pay', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // `requiresOtp` sits at the top level of the 202 body while `data` holds the
    // details; returning `response.data` alone dropped the flag and let the
    // caller treat an OTP challenge as a completed payment.
    return { ...response, ...(response?.data || {}) };
  }

  // ============ PAYMENTS ============

  async getPaymentDetails(paymentId: string): Promise<any> {
    return this.request(`/payments/${paymentId}`);
  }

  async getUserPayments(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    return this.request(`/payments/my-payments?${searchParams.toString()}`);
  }

  async confirmPayment(sessionId: string, orderId: string): Promise<any> {
    return this.request('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId, orderId }),
    });
  }

  // ============ REFUNDS ============

  async getCustomerRefunds(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiRefundListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const response = await this.request<{ success: boolean; data: ApiRefundListResponse }>(
      `/refunds/my-refunds?${searchParams.toString()}`
    );

    return response?.data || { refunds: [], pagination: { page: 1, limit: 10, total: 0, pages: 1 } };
  }

  async getAdminRefunds(params?: {
    page?: number;
    limit?: number;
    status?: string;
    returnStatus?: 'pending' | 'picked' | 'received' | 'not_required';
  }): Promise<ApiRefundListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const response = await this.request<{ success: boolean; data: ApiRefundListResponse }>(
      `/refunds/admin/list?${searchParams.toString()}`
    );

    return response?.data || { refunds: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } };
  }

  async createRefundRequestByOrder(data: {
    orderId: string;
    orderItemId?: string;
    paymentId?: string;
    amount: number;
    reason: string;
    refundType?: 'return' | 'refund' | 'exchange';
    details?: string;
    returnStatus?: 'pending' | 'picked' | 'received' | 'not_required';
  }): Promise<ApiRefund> {
    const response = await this.request<{ success: boolean; data: ApiRefund }>('/refunds', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return response?.data;
  }

  async getVendorRefunds(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiRefundListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const response = await this.request<{ success: boolean; data: ApiRefundListResponse }>(
      `/refunds/vendor/refunds?${searchParams.toString()}`
    );

    return response?.data || { refunds: [], pagination: { page: 1, limit: 10, total: 0, pages: 1 } };
  }

  async createRefundRequest(orderItemId: string, data: {
    refundType?: 'return' | 'refund' | 'exchange';
    returnReason: {
      category: string;
      description: string;
      detailedExplanation?: string;
    };
    productCondition?: {
      packaging?: 'unopened' | 'opened' | 'damaged' | 'missing';
      productState?: 'new_unused' | 'used' | 'damaged' | 'defective';
      accessories?: 'all_included' | 'missing_some' | 'missing_all' | 'not_applicable';
    };
    quantity?: number;
    refundMethod?: 'original_payment' | 'bank_transfer';
    pickupAddress?: {
      fullName?: string;
      phone?: string;
      addressLine1?: string;
      addressLine2?: string;
      district?: string;
      postalCode?: string;
    };
  }): Promise<ApiRefund> {
    const response = await this.request<{ success: boolean; data: ApiRefund }>(
      `/refunds/create/${orderItemId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    return response?.data;
  }

  async approveOrRejectRefund(refundId: string, data: {
    status: 'Approved' | 'Rejected' | 'approved' | 'rejected';
    comments?: string;
    reason?: string;
  }): Promise<ApiRefund> {
    const response = await this.request<{ success: boolean; data: ApiRefund }>(`/refunds/${refundId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    return response?.data;
  }

  async updateRefundReturnStatus(refundId: string, returnStatus: 'pending' | 'picked' | 'received' | 'not_required'): Promise<ApiRefund> {
    const response = await this.request<{ success: boolean; data: ApiRefund }>(`/refunds/${refundId}/return-status`, {
      method: 'PATCH',
      body: JSON.stringify({ returnStatus }),
    });

    return response?.data;
  }

  // ============ POLICIES ============

  async getPolicy(policyType: string): Promise<any> {
    return this.request(`/policies/${policyType}`);
  }

  async getAllPublicPolicies(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/policies');
    return response?.data || [];
  }

  async getPolicyWithFAQ(policyType: string): Promise<any> {
    return this.request(`/policies/${policyType}/faq`);
  }

  async searchPolicies(query: string, isActive?: boolean): Promise<any[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    if (isActive !== undefined) searchParams.set('isActive', String(isActive));
    const response = await this.request<{ success: boolean; data: any[] }>(`/policies/search?${searchParams.toString()}`);
    return response?.data || [];
  }

  async getReturnPolicyForCategory(category?: string): Promise<any> {
    const searchParams = new URLSearchParams();
    if (category) searchParams.set('category', category);
    const response = await this.request<{ success: boolean; data: any }>(`/policies/utils/return-policy?${searchParams.toString()}`);
    return response?.data;
  }

  async getShippingPolicy(): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>('/policies/utils/shipping-policy');
    return response?.data;
  }

  // Admin policy methods
  async createPolicy(data: {
    policyType: 'return' | 'shipping' | 'cancellation' | 'terms_conditions' | 'privacy' | 'warranty';
    title: string;
    description: string;
    content: string;
    sections?: Array<{ title: string; content: string; order: number }>;
    metadata?: any;
    displaySettings?: any;
  }): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>('/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response?.data;
  }

  async updatePolicy(policyType: string, data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/policies/${policyType}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response?.data;
  }

  async getAllPolicies(filters?: { policyType?: string; isActive?: boolean }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (filters?.policyType) searchParams.set('policyType', filters.policyType);
    if (filters?.isActive !== undefined) searchParams.set('isActive', String(filters.isActive));
    const response = await this.request<{ success: boolean; data: any[] }>(`/policies/admin/all?${searchParams.toString()}`);
    return response?.data || [];
  }

  async getPolicyVersionHistory(policyType: string): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>(`/policies/admin/versions/${policyType}`);
    return response?.data || [];
  }

  async addPolicyFAQ(policyType: string, data: { question: string; answer: string; category?: string }): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/policies/${policyType}/faq`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response?.data;
  }

  async deactivatePolicy(policyType: string): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/policies/${policyType}/deactivate`, {
      method: 'PATCH',
    });
    return response?.data;
  }

  // ============ NOTIFICATIONS ============

  async getNotifications(params?: {
    page?: number;
    limit?: number;
    type?: string;
    isRead?: boolean;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<ApiNotificationListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const queryString = searchParams.toString();
    const response = await this.request<{ success: boolean; data: ApiNotificationListResponse }>(
      `/notifications${queryString ? `?${queryString}` : ''}`
    );

    return response?.data || {
      notifications: [],
      total: 0,
      page: params?.page || 1,
      limit: params?.limit || 10,
      pages: 0,
    };
  }

  async getUnreadNotificationCount(): Promise<number> {
    const response = await this.request<{ success: boolean; unreadCount: number }>(
      '/notifications/unread/count'
    );
    return response?.unreadCount ?? 0;
  }

  async markNotificationAsRead(notificationId: string): Promise<ApiNotification> {
    const response = await this.request<{ success: boolean; data: ApiNotification }>(
      `/notifications/${notificationId}/read`,
      { method: 'PUT' }
    );
    return response.data;
  }

  async markAllNotificationsAsRead(): Promise<{ modifiedCount?: number; matchedCount?: number }> {
    const response = await this.request<{ success: boolean; data: { modifiedCount?: number; matchedCount?: number } }>(
      '/notifications/read/all',
      { method: 'PUT' }
    );
    return response?.data || {};
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}`, { method: 'DELETE' });
  }

  async deleteAllNotifications(): Promise<{ deletedCount?: number }> {
    const response = await this.request<{ success: boolean; data: { deletedCount?: number } }>(
      '/notifications',
      { method: 'DELETE' }
    );
    return response?.data || {};
  }

  // ============ INVENTORY ============

  async checkStockAvailability(productId: string, quantity: number): Promise<boolean> {
    const response = await this.request<{ success: boolean; available?: boolean }>(
      '/inventory/check-availability',
      {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      }
    );

    return !!response?.available;
  }

  async getAvailableStock(productId: string): Promise<number> {
    const response = await this.request<{ success: boolean; data?: { available?: number } }>(
      `/inventory/available/${productId}`
    );
    return response?.data?.available ?? 0;
  }

  async getStockSummary(productId: string): Promise<ApiStockSummary> {
    const response = await this.request<{ success: boolean; data: ApiStockSummary }>(
      `/inventory/summary/${productId}`
    );

    return response?.data || {
      totalStock: 0,
      reserved: 0,
      available: 0,
      reservationCount: 0,
    };
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

  // ============ WISHLIST ============

  async getWishlist(): Promise<{ products: ApiProduct[] }> {
    return this.request<{ products: ApiProduct[] }>('/wishlist');
  }

  async getWishlistIds(): Promise<{ productIds: string[] }> {
    return this.request<{ productIds: string[] }>('/wishlist/ids');
  }

  async addToWishlist(productId: string): Promise<{ message: string; productIds: string[] }> {
    return this.request<{ message: string; productIds: string[] }>(`/wishlist/${productId}`, {
      method: 'POST',
    });
  }

  async removeFromWishlist(productId: string): Promise<{ message: string; productIds: string[] }> {
    return this.request<{ message: string; productIds: string[] }>(`/wishlist/${productId}`, {
      method: 'DELETE',
    });
  }

  // ============ SELLER CUSTOMERS ============

  async getSellerCustomers(): Promise<{
    success: boolean;
    data: Array<{
      customerId: string;
      name: string;
      email: string;
      totalOrders: number;
      totalSpent: number;
      lastOrderAt: string;
    }>;
    total: number;
  }> {
    return this.request('/orders/seller/customers');
  }
}

export const api = new ApiClient();