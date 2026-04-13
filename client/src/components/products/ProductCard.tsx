import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Check, AlertCircle } from 'lucide-react';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/currency';

interface ProductCardProps {
  product: Product;
  isCompatible?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isCompatible = true }) => {
  const { addToCart } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!user) {
      toast.error('Please login to add items to cart');
      navigate('/auth/customer');
      return;
    }
    
    addToCart(product);
    toast.success(`${product.name} added to cart`);
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
      {!isCompatible && (
        <div className="absolute top-3 left-3 z-10">
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Not Compatible
          </Badge>
        </div>
      )}

      {isCompatible && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-success/20 text-success border-success/30 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Compatible
          </Badge>
        </div>
      )}

      {/* Stock Badge */}
      <div className="absolute top-3 right-3 z-10">
        {product.stock > 10 ? (
          <Badge variant="outline" className="border-success/50 text-success">
            In Stock
          </Badge>
        ) : product.stock > 0 ? (
          <Badge variant="outline" className="border-warning/50 text-warning">
            Low Stock
          </Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/50 text-destructive">
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
          className="w-full h-full transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
