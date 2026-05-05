import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Percent, Clock, Loader2, Copy, Check } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ProductCard from '@/components/products/ProductCard';
import PaginationControls from '@/components/common/PaginationControls';
import { api, ApiProduct, ApiCoupon } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { formatLKR } from '@/lib/currency';

const Deals: React.FC = () => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const [response, activeCoupons] = await Promise.all([
          api.getProducts({ isActive: true, limit: 1000 }),
          api.getPublicActiveCoupons(6),
        ]);
        // Filter products with stock > 10 as "deals"
        const dealProducts = (response.data || []).filter(p => p.stock > 10);
        setProducts(dealProducts);
        setCoupons(activeCoupons);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
      }
      setLoading(false);
    };
    fetchDeals();
  }, []);

  const {
    paginatedItems: paginatedProducts,
    currentPage,
    totalPages,
    goToPage,
  } = usePagination(products, { itemsPerPage: 12 });

  const mapToProductCard = (p: ApiProduct) => ({
    id: p.id || p._id || '',
    name: p.name,
    description: p.description || '',
    price: p.price,
    image: p.imageUrl || '/placeholder.svg',
    category: p.category?.name || 'Uncategorized',
    brand: '',
    shopId: p.shopId,
    shopName: p.shop?.name || 'Unknown Shop',
    stock: p.stock,
    compatibleVehicles: (p.compatibleVehicles || []).map((v) =>
      typeof v === 'string' ? v : `${v.year} ${v.make} ${v.model}`
    ),
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    sku: p.sku || '',
  });

  const copyCouponCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy coupon code:', error);
    }
  };

  const formatCouponDiscount = (coupon: ApiCoupon) => {
    if (coupon.discountType === 'percentage') {
      return `${coupon.discountValue}% OFF`;
    }
    return `${formatLKR(coupon.discountValue)} OFF`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/30 mb-6">
            <Tag className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">Limited Time Offers</span>
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            HOT <span className="text-primary">DEALS</span>
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Don't miss out on these incredible savings. Shop now while supplies last!
          </p>
        </motion.div>

        {/* Deal Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: Percent, title: 'Up to 30% Off', desc: 'On select performance parts' },
            { icon: Tag, title: 'Bundle Deals', desc: 'Save more when you buy together' },
            { icon: Clock, title: 'Flash Sales', desc: 'New deals every week' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6 flex items-center gap-4"
            >
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {coupons.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl font-bold">Available Coupons</h2>
              <p className="text-sm text-muted-foreground">Copy a code and apply it in checkout</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coupons.map((coupon, index) => (
                <motion.div
                  key={coupon.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-4 border border-primary/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-bold text-primary">{coupon.code}</p>
                      <p className="text-xs text-muted-foreground mt-1">{coupon.description || 'Limited-time offer'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCouponCode(coupon.code)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:border-primary/40"
                    >
                      {copiedCode === coupon.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedCode === coupon.code ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-green-500">{formatCouponDiscount(coupon)}</span>
                    {(coupon.minimumOrderAmount || 0) > 0 && (
                      <span className="text-muted-foreground">Min {formatLKR(coupon.minimumOrderAmount || 0)}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No deals available at the moment. Check back soon!</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {paginatedProducts.map((product, i) => (
                <motion.div
                  key={product.id || product._id || i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard product={mapToProductCard(product)} />
                </motion.div>
              ))}
            </div>
            
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Deals;
