import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ApiProduct } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { formatLKR } from '@/lib/currency';
import { toast } from 'sonner';
import { useSeo } from '@/hooks/useSeo';

const Wishlist: React.FC = () => {
  useSeo({ title: 'Wishlist', noindex: true });
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, setWishlistIds, toggleWishlistId } = useStore();

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const res = await api.getWishlist();
        setProducts(res.products || []);
        setWishlistIds((res.products || []).map((p: ApiProduct) => p.id || p._id || ''));
      } catch {
        toast.error('Failed to load wishlist');
      } finally {
        setLoading(false);
      }
    };
    fetchWishlist();
  }, [setWishlistIds]);

  const handleRemove = async (productId: string) => {
    try {
      await api.removeFromWishlist(productId);
      setProducts((prev) => prev.filter((p) => (p.id || p._id) !== productId));
      toggleWishlistId(productId);
      toast.success('Removed from wishlist');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const handleAddToCart = (product: ApiProduct) => {
    addToCart({
      id: product.id || product._id || '',
      product: {
        id: product.id || product._id || '',
        name: product.name,
        price: product.price,
        image: product.image || '/placeholder.svg',
        shopId: product.shopId,
        sku: product.sku,
        stock: product.stock,
      },
      quantity: 1,
    });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Heart className="h-7 w-7 text-red-500 fill-red-500" />
          <div>
            <h1 className="text-3xl font-display font-bold">My Wishlist</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {products.length} {products.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-6">
              Save items you love by clicking the heart icon on any product.
            </p>
            <Button asChild>
              <Link to="/shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Browse Shop
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {products.map((product) => {
                const productId = product.id || product._id || '';
                const inStock = (product.stock ?? 0) > 0;
                return (
                  <motion.div
                    key={productId}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="glass-card rounded-xl overflow-hidden group"
                  >
                    <Link to={`/product/${productId}`} className="block">
                      <div className="relative aspect-square bg-secondary/50 overflow-hidden">
                        <img
                          src={product.image || '/placeholder.svg'}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {!inStock && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                            <Badge variant="destructive">Out of Stock</Badge>
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="p-4 space-y-3">
                      <Link to={`/product/${productId}`}>
                        <h3 className="font-semibold text-sm line-clamp-2 hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-lg font-bold text-primary">{formatLKR(product.price)}</p>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          disabled={!inStock}
                          onClick={() => handleAddToCart(product)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Add to Cart
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-2.5 text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handleRemove(productId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
