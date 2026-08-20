import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Navbar from '@/components/layout/Navbar';
import { useStore } from '@/store/useStore';
import { formatLKR } from '@/lib/currency';

const Cart: React.FC = () => {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const { cart, removeFromCart, updateQuantity, getCartTotal, clearCart } = useStore();

  const handleClearCartClick = () => {
    setConfirmClearOpen(true);
  };

  const handleConfirmClear = async () => {
    setConfirmClearOpen(false);
    await clearCart();
  };

  const subtotal = getCartTotal();
  const shipping = subtotal > 15000 ? 0 : 500;
  const taxAmount = Math.round(subtotal * 0.18);
  const total = subtotal + shipping + taxAmount;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="font-display text-3xl font-bold mb-4">Your Cart is Empty</h1>
            <p className="text-muted-foreground mb-8">
              Looks like you haven't added any parts yet
            </p>
            <Link to="/shop">
              <Button className="neon-button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Continue Shopping
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold">
              SHOPPING <span className="text-primary">CART</span>
            </h1>
            <Button variant="ghost" onClick={handleClearCartClick} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cart
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item, i) => {
                if (!item.product) return null; // Defensive check for malformed cached cart items
                return (
                <motion.div
                  key={item.product.id || i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-4"
                >
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="text-xs text-primary mb-1">{item.product.brand}</p>
                          <h3 className="font-medium line-clamp-1">{item.product.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            SKU: {item.product.sku}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-bold text-primary">
                            {formatLKR(item.product.price * item.quantity)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatLKR(item.product.price)} each
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(item.product.id, Math.max(1, item.quantity - 1))
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.product.id,
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-16 h-8 text-center bg-secondary/50"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.id || item.product.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-6 sticky top-24"
              >
                <h2 className="font-display text-xl font-bold mb-6">Order Summary</h2>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatLKR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{formatLKR(shipping)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (18%)</span>
                    <span>{formatLKR(taxAmount)}</span>
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex justify-between">
                    <span className="font-display font-bold">Total</span>
                    <span className="font-display text-xl font-bold text-primary">
                      {formatLKR(total)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Shipping is an estimate; final zone-based charge is calculated at checkout.
                </p>

                <Link to="/checkout">
                  <Button className="w-full mt-6 neon-button">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Checkout
                  </Button>
                </Link>

                <Link to="/shop">
                  <Button variant="ghost" className="w-full mt-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Continue Shopping
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Cart?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all items from your cart?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmClear}>
              Clear Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cart;
