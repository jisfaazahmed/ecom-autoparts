import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Zap, Shield, Truck, Star, ArrowRight,
  Car, Cog, Disc, Lightbulb, Gauge, CircleDot, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import ProductCard from '@/components/products/ProductCard';
import VehicleSelector from '@/components/vehicle/VehicleSelector';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiProduct, ApiCategory } from '@/lib/api';
import heroImage from '@/assets/hero-automotive.jpg';

const iconMap: Record<string, React.ElementType> = {
  Cog, Disc, Zap, Car, Armchair: Car, Gauge, CircleDot, Lightbulb
};

const Index: React.FC = () => {
  const { userVehicle } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          api.getProducts({ isActive: true, limit: 4 }),
          api.getCategories()
        ]);

        setProducts(productsRes.data || []);
        setCategories(categoriesRes || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const features = [
    { icon: Zap, title: 'Fast Shipping', desc: 'Free delivery on orders over LKR 50,000' },
    { icon: Shield, title: 'OEM Quality', desc: 'Certified authentic parts' },
    { icon: Truck, title: 'Easy Returns', desc: '30-day hassle-free returns' },
    { icon: Star, title: 'Expert Support', desc: '24/7 technical assistance' },
  ];

  const mapToProductCard = (p: ApiProduct) => ({
    id: p.id,
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Performance automotive" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="absolute inset-0 bg-cyber-grid bg-[length:40px_40px] opacity-20" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />

        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-sm text-primary font-medium">Premium Auto Parts Marketplace</span>
            </motion.div>

            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="text-foreground">UPGRADE YOUR</span>
              <br />
              <span className="text-glow text-primary">RIDE</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Discover thousands of performance parts from verified sellers. 
              Smart compatibility filtering ensures every part fits your vehicle perfectly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {user ? (
                <VehicleSelector
                  trigger={
                    <Button size="lg" className="neon-button text-base px-8">
                      <Car className="mr-2 h-5 w-5" />
                      {userVehicle ? 'Add another vehicle' : 'Add My Vehicle'}
                    </Button>
                  }
                />
              ) : (
                <Button size="lg" className="neon-button text-base px-8" onClick={() => navigate('/auth/customer')}>
                  <Car className="mr-2 h-5 w-5" />
                  Add My Vehicle
                </Button>
              )}
              <Link to="/shop">
                <Button size="lg" variant="outline" className="border-border/50 hover:border-primary/50 text-base px-8">
                  Browse Parts
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex gap-12 mt-12 pt-8 border-t border-border/30"
            >
              {[
                { value: '50K+', label: 'Products' },
                { value: '2K+', label: 'Vendors' },
                { value: '98%', label: 'Satisfaction' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="font-display text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 border-y border-border/30 bg-secondary/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-4"
              >
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              SHOP BY <span className="text-primary">CATEGORY</span>
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Find exactly what you need from our extensive catalog of automotive parts
            </p>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : categories.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No categories available yet.</p>
          ) : (
            (() => {
              const parentCategories = categories.filter((c: ApiCategory) => !c.parentId);
              const getSubcategories = (parentId: string) => categories.filter((c: ApiCategory) => c.parentId === parentId);
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {parentCategories.slice(0, 8).map((parent, i) => {
                    const Icon = iconMap[parent.icon || 'Cog'] || Cog;
                    const subs = getSubcategories(parent.id);
                    return (
                      <motion.div
                        key={parent.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ delay: i * 0.05 }}
                        viewport={{ once: true }}
                        className="flex flex-col"
                      >
                        <Link
                          to={`/shop?category=${parent.id}`}
                          className="block glass-card p-6 group hover:border-primary/50 transition-colors flex-1"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 group-hover:bg-primary/20 transition-colors">
                              <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <h3 className="font-display text-sm font-semibold mb-1">{parent.name}</h3>
                          <p className="text-xs text-muted-foreground">{parent.description || 'Browse products'}</p>
                        </Link>
                        {subs.length > 0 && (
                          <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-1">
                            {subs.map((sub) => {
                              const SubIcon = iconMap[sub.icon || 'Cog'] || Cog;
                              return (
                                <Link
                                  key={sub.id}
                                  to={`/shop?category=${sub.id}`}
                                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                                >
                                  <SubIcon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{sub.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-secondary/20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                FEATURED <span className="text-primary">PARTS</span>
              </h2>
              <p className="text-muted-foreground">
                Top-rated products from our verified vendors
              </p>
            </div>
            <Link to="/shop">
              <Button variant="outline" className="hidden md:flex border-border/50 hover:border-primary/50">
                View All
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No products available yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <ProductCard product={mapToProductCard(product)} />
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <Link to="/shop">
              <Button variant="outline" className="border-border/50 hover:border-primary/50">
                View All Products
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-card p-12 md:p-16 text-center overflow-hidden"
          >
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyber-purple/20 rounded-full blur-[100px]" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                BECOME A <span className="text-primary">SELLER</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8">
                Join our marketplace and reach thousands of automotive enthusiasts. 
                Start selling your parts today with our easy vendor onboarding.
              </p>
              <Link to="/seller/auth">
                <Button size="lg" className="neon-button px-8">
                  Apply Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-secondary/30">
        <div className="container py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Car className="h-8 w-8 text-primary" />
                <span className="font-display text-xl font-bold">
                  AUTO<span className="text-primary">MATRIX</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Your trusted marketplace for premium automotive parts. Quality guaranteed, performance delivered.
              </p>
              <div className="flex gap-3">
                <a href="#" className="p-2 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors">
                  <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </a>
                <a href="#" className="p-2 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors">
                  <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="#" className="p-2 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors">
                  <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M22.676 0h-21.352c-.732 0-1.324.593-1.324 1.324v21.352c0 .732.593 1.324 1.324 1.324h11.494v-9.294h-3.129v-3.621h3.129v-2.672c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.794.143v3.24l-1.918.001c-1.504 0-1.794.715-1.794 1.763v2.313h3.587l-.467 3.621h-3.12v9.294h6.116c.73 0 1.324-.592 1.324-1.324v-21.352c0-.731-.593-1.324-1.324-1.324z"/></svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-display font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li><Link to="/shop" className="text-sm text-muted-foreground hover:text-primary transition-colors">Shop All Parts</Link></li>
                <li><Link to="/categories" className="text-sm text-muted-foreground hover:text-primary transition-colors">Categories</Link></li>
                <li><Link to="/deals" className="text-sm text-muted-foreground hover:text-primary transition-colors">Deals & Offers</Link></li>
                <li><Link to="/my-vehicle" className="text-sm text-muted-foreground hover:text-primary transition-colors">My Vehicle</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-display font-semibold mb-4">Support</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQs</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Shipping Info</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Returns Policy</a></li>
              </ul>
            </div>

            {/* Sellers */}
            <div>
              <h4 className="font-display font-semibold mb-4">Sellers</h4>
              <ul className="space-y-3">
                <li><Link to="/auth/seller" className="text-sm text-muted-foreground hover:text-primary transition-colors">Become a Seller</Link></li>
                <li><Link to="/auth/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">Seller Login</Link></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Seller Guidelines</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Commission Rates</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/30 mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 AutoMatrix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
