import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Percent, Clock, Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ProductCard from '@/components/products/ProductCard';
import PaginationControls from '@/components/common/PaginationControls';
import { api, ApiProduct } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';

const Deals: React.FC = () => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await api.getProducts({ isActive: true, limit: 1000 });
        // Filter products with stock > 10 as "deals"
        const dealProducts = (response.data || []).filter(p => p.stock > 10);
        setProducts(dealProducts);
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
    compatibleVehicles: p.compatibleVariants || [],
    rating: 4.5,
    reviewCount: 0,
    sku: p.sku || '',
  });

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
