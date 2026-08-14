import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Check, AlertCircle, Heart, GitCompare } from 'lucide-react';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/currency';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  isCompatible?: boolean;
  showCompatibilityBadge?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isCompatible = true,
  showCompatibilityBadge = true,
}) => {
  const { addToCart, wishlistIds, toggleWishlistId, addToCompare, compareItems } = useStore();
  const { user } = useAuth();
  const isWishlisted = wishlistIds.includes(product.id);
  const isInCompare = compareItems.some((c) => c.id === product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ id: product.id, product, quantity: 1 });
    toast.success(`${product.name} added to cart`);
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

  return (
    <Link to={`/product/${product.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.3 }}
        className="group relative glass-card overflow-hidden cursor-pointer"
      >
      {/* Compatibility Badge */}
      {showCompatibilityBadge && !isCompatible && (
        <div className="absolute top-3 left-3 z-10">
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Not Compatible
          </Badge>
        </div>
      )}

      {showCompatibilityBadge && isCompatible && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-primary text-primary-foreground border-primary/80 shadow-sm flex items-center gap-1">
            <Check className="h-3 w-3" />
            Compatible
          </Badge>
        </div>
      )}

      {/* Stock Badge */}
      {/* Discount Badge */}
      {!!(product.effectiveDiscountPercent && product.effectiveDiscountPercent > 0) && (
        <div className="absolute bottom-3 left-3 z-10">
          <Badge className="bg-destructive/90 text-white border-destructive/80">
            -{Math.round(product.effectiveDiscountPercent)}%
          </Badge>
        </div>
      )}

      <div className="absolute top-3 right-3 z-10">
        {product.stock > 10 ? (
          <Badge className="bg-primary text-primary-foreground border-primary/80 shadow-sm">
            In Stock
          </Badge>
        ) : product.stock > 0 ? (
          <Badge className="bg-warning text-black border-warning/80 shadow-sm">
            Low Stock
          </Badge>
        ) : (
          <Badge className="bg-destructive text-destructive-foreground border-destructive/80 shadow-sm">
            Out of Stock
          </Badge>
        )}
      </div>

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

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-primary font-medium mb-1">{product.brand}</p>
          <h3 className="font-display text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  i < Math.floor(product.rating)
                    ? 'text-warning fill-warning'
                    : 'text-muted-foreground'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            ({product.reviewCount})
          </span>
        </div>

        {/* Shop */}
        <p className="text-xs text-muted-foreground">
          Sold by <span className="text-foreground">{product.shopName}</span>
        </p>

        {/* Price & Action */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div>
            <span className="font-display text-lg font-bold text-primary">
              {formatLKR(product.price)}
            </span>
            {!!(product.originalPrice && product.originalPrice > product.price) && (
              <p className="text-xs text-muted-foreground line-through">
                {formatLKR(product.originalPrice)}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={product.stock === 0 || !isCompatible}
            className="neon-button text-xs px-3"
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
