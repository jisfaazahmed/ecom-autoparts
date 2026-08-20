import React from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, X, ShoppingCart, Plus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore, CompareItem } from '@/store/useStore';
import { formatLKR } from '@/lib/currency';
import { toast } from 'sonner';
import { useSeo } from '@/hooks/useSeo';

const MAX_COMPARE = 4;

// Attribute rows to compare
const ROWS: { label: string; key: keyof CompareItem }[] = [
  { label: 'Brand / Shop', key: 'shopName' },
  { label: 'Category', key: 'category' },
  { label: 'SKU', key: 'sku' },
  { label: 'Stock', key: 'stock' },
  { label: 'Rating', key: 'rating' },
];

const Compare: React.FC = () => {
  useSeo({ title: 'Compare Parts', noindex: true });
  const { compareItems, removeFromCompare, clearCompare, addToCart } = useStore();

  const handleAddToCart = (item: CompareItem) => {
    if (item.stock === 0 || item.stock === '0') {
      toast.error('This product is out of stock');
      return;
    }
    addToCart({
      id: item.id,
      product: {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || '/placeholder.svg',
        shopId: item.shopId || '',
        sku: item.sku,
        stock: Number(item.stock) || 0,
      },
      quantity: 1,
    });
    toast.success(`${item.name} added to cart`);
  };

  const placeholderCount = MAX_COMPARE - compareItems.length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <GitCompare className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Compare Products</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {compareItems.length} of {MAX_COMPARE} slots used
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Shop
              </Link>
            </Button>
            {compareItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCompare} className="text-destructive hover:text-destructive">
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {compareItems.length === 0 ? (
          <div className="text-center py-24">
            <GitCompare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nothing to compare yet</h2>
            <p className="text-muted-foreground mb-6">
              Click the compare icon on any product to add it here.
            </p>
            <Button asChild>
              <Link to="/shop">Browse Shop</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
              {/* Product columns header */}
              <thead>
                <tr>
                  {/* Label column */}
                  <th className="w-36 pr-4 pb-4" />
                  <AnimatePresence>
                    {compareItems.map((item) => (
                      <motion.th
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="px-3 pb-4 align-top"
                        style={{ minWidth: '180px' }}
                      >
                        <div className="glass-card rounded-xl overflow-hidden">
                          {/* Remove button */}
                          <div className="relative">
                            <Link to={`/product/${item.id}`}>
                              <img
                                src={item.image || '/placeholder.svg'}
                                alt={item.name}
                                className="w-full aspect-square object-cover hover:opacity-80 transition-opacity"
                              />
                            </Link>
                            <button
                              onClick={() => removeFromCompare(item.id)}
                              className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-white transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="p-3 space-y-2">
                            <Link to={`/product/${item.id}`}>
                              <p className="font-semibold text-sm line-clamp-2 hover:text-primary transition-colors">
                                {item.name}
                              </p>
                            </Link>
                            <p className="text-base font-bold text-primary">{formatLKR(item.price)}</p>
                          </div>
                        </div>
                      </motion.th>
                    ))}

                    {/* Empty placeholder slots */}
                    {Array.from({ length: placeholderCount }).map((_, i) => (
                      <th key={`empty-${i}`} className="px-3 pb-4 align-top" style={{ minWidth: '180px' }}>
                        <Link
                          to="/shop"
                          className="flex flex-col items-center justify-center h-52 rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground"
                        >
                          <Plus className="h-8 w-8 mb-2 opacity-40" />
                          <span className="text-xs">Add product</span>
                        </Link>
                      </th>
                    ))}
                  </AnimatePresence>
                </tr>
              </thead>

              {/* Attribute rows */}
              <tbody>
                {ROWS.map((row, rowIdx) => (
                  <tr
                    key={row.key}
                    className={rowIdx % 2 === 0 ? 'bg-secondary/10' : ''}
                  >
                    <td className="pr-4 py-3 text-sm text-muted-foreground font-medium whitespace-nowrap">
                      {row.label}
                    </td>
                    {compareItems.map((item) => {
                      const val = item[row.key];
                      if (row.key === 'stock') {
                        const num = Number(val);
                        return (
                          <td key={item.id} className="px-3 py-3 text-center">
                            <Badge variant={num > 0 ? 'default' : 'destructive'} className="text-xs">
                              {num > 0 ? `${num} in stock` : 'Out of stock'}
                            </Badge>
                          </td>
                        );
                      }
                      if (row.key === 'rating') {
                        const num = Number(val) || 0;
                        return (
                          <td key={item.id} className="px-3 py-3 text-center text-sm">
                            {num > 0 ? (
                              <span className="flex items-center justify-center gap-1">
                                <span className="text-yellow-400">★</span>
                                {num.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">No reviews</span>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={item.id} className="px-3 py-3 text-sm text-center">
                          {val ? String(val) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      );
                    })}
                    {Array.from({ length: placeholderCount }).map((_, i) => (
                      <td key={`empty-${i}`} className="px-3 py-3 text-center text-muted-foreground/20">—</td>
                    ))}
                  </tr>
                ))}

                {/* Add to Cart row */}
                <tr>
                  <td className="pr-4 py-4 text-sm text-muted-foreground font-medium">Action</td>
                  {compareItems.map((item) => (
                    <td key={item.id} className="px-3 py-4 text-center">
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={Number(item.stock) === 0}
                        onClick={() => handleAddToCart(item)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add to Cart
                      </Button>
                    </td>
                  ))}
                  {Array.from({ length: placeholderCount }).map((_, i) => (
                    <td key={`empty-${i}`} className="px-3 py-4" />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;
