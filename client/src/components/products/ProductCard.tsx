import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Check, AlertCircle, Heart, GitCompare } from 'lucide-react';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/currency';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  isCompatible?: boolean;
  variant?: 'grid' | 'list';
  showCompatibilityBadge?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isCompatible,
  variant = 'grid',
  showCompatibilityBadge = true,
}) => {
  const { addToCart, wishlistIds, toggleWishlistId, addToCompare, compareItems } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isWishlisted = wishlistIds.includes(product.id);
  const isInCompare = compareItems.some((c) => c.id === product.id);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error('Please sign in to add items to cart');
      return;
    }

    try {
      await addToCart({ id: product.id, product, quantity: 1 });
      toast.success(`${product.name} added to cart`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add to cart';
      toast.error(message);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Sign in to save items to your wishlist');
      return;
    }
    try {
      if (isWishlisted) {
        await api.removeFromWishlist(product.id);
        toggleWishlistId(product.id);
        toast.success('Removed from wishlist');
      } else {
        await api.addToWishlist(product.id);
        toggleWishlistId(product.id);
        toast.success('Added to wishlist');
      }
    } catch {
      toast.error('Failed to update wishlist');
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCompare) {
      toast.info('Already in compare list');
      return;
    }
    if (compareItems.length >= 4) {
      toast.error('Compare list is full (max 4)');
      return;
    }
    addToCompare({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      brand: product.brand,
      stock: product.stock,
      rating: product.rating,
      reviewCount: product.reviewCount,
      sku: product.sku,
      shopName: product.shopName,
    });
    toast.success('Added to compare');
  };

  const stockBadge =
    product.stock > 10 ? (
      <Badge variant="outline" className="bg-success/15 border-success/50 text-success shrink-0">
        In Stock
      </Badge>
    ) : product.stock > 0 ? (
      <Badge variant="outline" className="bg-warning/15 border-warning/50 text-warning shrink-0">
        Low Stock
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-destructive/15 border-destructive/50 text-destructive shrink-0">
        Out of Stock
      </Badge>
    );

  const compatibilityBadge = !showCompatibilityBadge
    ? null
    : isCompatible === false ? (
      <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
        <AlertCircle className="h-3 w-3" />
        Not Compatible
      </Badge>
    ) : isCompatible === true ? (
      <Badge variant="outline" className="bg-success/20 text-success border-success/30 flex items-center gap-1 shrink-0">
        <Check className="h-3 w-3" />
        Compatible
      </Badge>
    ) : null;

  const ratingStars = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < Math.floor(product.rating)
              ? 'text-warning fill-warning'
              : 'text-muted-foreground'
              }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
    </div>
  );

  if (variant === 'list') {
    return (
      <Link to={`/product/${product.id}`}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="group relative glass-card overflow-hidden cursor-pointer flex gap-4 p-3"
        >
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-md bg-secondary/50 overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2 py-0.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {compatibilityBadge}
                {stockBadge}
              </div>
              {product.brand && (
                <p className="text-xs text-primary font-medium">{product.brand}</p>
              )}
              <h3 className="font-display text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                {product.name}
              </h3>
              {product.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">
                  {product.description}
                </p>
              )}
              {ratingStars}
              <p className="text-xs text-muted-foreground line-clamp-1">
                Sold by <span className="text-foreground">{product.shopName}</span>
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-base font-bold text-primary">
                {formatLKR(product.price)}
              </span>
              <Button
                size="sm"
                onClick={handleAddToCart}
                disabled={product.stock === 0 || isCompatible === false}
                className="neon-button text-xs px-3 shrink-0"
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={`/product/${product.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.3 }}
        className="group relative glass-card overflow-hidden cursor-pointer"
      >
        {compatibilityBadge && (
          <div className="absolute top-3 left-3 z-10">{compatibilityBadge}</div>
        )}

        <div className="absolute top-3 right-3 z-10">{stockBadge}</div>

        {/* Image */}
        <div className="relative aspect-square bg-secondary/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Wishlist + Compare overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
            <button
              onClick={handleWishlist}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors',
                isWishlisted
                  ? 'bg-red-500 text-white'
                  : 'bg-background/80 text-foreground hover:bg-red-500 hover:text-white'
              )}
              title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
            </button>
            <button
              onClick={handleCompare}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors',
                isInCompare
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background/80 text-foreground hover:bg-primary hover:text-primary-foreground'
              )}
              title="Add to compare"
            >
              <GitCompare className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            {product.brand && (
              <p className="text-xs text-primary font-medium mb-1">{product.brand}</p>
            )}
            <h3 className="font-display text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </div>

          {ratingStars}

          <p className="text-xs text-muted-foreground">
            Sold by <span className="text-foreground">{product.shopName}</span>
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div>
              <span className="font-display text-lg font-bold text-primary">
                {formatLKR(product.price)}
              </span>
              {!!(product.originalPrice && product.originalPrice > product.price) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground line-through">
                    {formatLKR(product.originalPrice)}
                  </span>
                  {!!(product.effectiveDiscountPercent && product.effectiveDiscountPercent > 0) && (
                    <Badge className="bg-destructive/90 text-white border-destructive/80 text-[10px] px-1.5 py-0">
                      -{Math.round(product.effectiveDiscountPercent)}%
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || isCompatible === false}
              className="neon-button text-xs px-3"
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
