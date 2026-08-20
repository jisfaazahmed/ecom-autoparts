import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Cog, Disc, Zap, Car, Gauge, CircleDot, Lightbulb, Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { api, ApiCategory } from '@/lib/api';
import { useSeo } from '@/hooks/useSeo';

const iconMap: Record<string, React.ElementType> = {
  Cog, Disc, Zap, Car, Armchair: Car, Gauge, CircleDot, Lightbulb
};

const Categories: React.FC = () => {
  useSeo({
    title: 'Auto Parts Categories — Engine, Brakes, Suspension & More',
    description:
      'Shop auto parts by category: engine and drivetrain, brakes, suspension, electrical, lighting, interior and more, all from verified Sri Lankan sellers.',
    path: '/categories',
  });
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await api.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            SHOP BY <span className="text-primary">CATEGORY</span>
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Browse our extensive catalog of automotive parts organized by category
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No categories available yet.</p>
        ) : (
          (() => {
            const parentCategories = categories.filter((c) => !c.parentId);
            const getSubcategories = (parentId: string) => categories.filter((c) => c.parentId === parentId);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {parentCategories.map((parent, i) => {
                  const Icon = iconMap[parent.icon || 'Cog'] || Cog;
                  const subs = getSubcategories(parent.id);
                  return (
                    <motion.div
                      key={parent.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex flex-col"
                    >
                      <Link
                        to={`/shop?category=${parent.id}`}
                        className="block glass-card p-8 group hover:border-primary/50 transition-colors flex-1"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-8 w-8 text-primary" />
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="font-display text-lg font-semibold mb-2">{parent.name}</h3>
                        <p className="text-sm text-muted-foreground">{parent.description || 'Browse products in this category'}</p>
                      </Link>
                      {subs.length > 0 && (
                        <div className="mt-4 pl-4 border-l-2 border-primary/20 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcategories</p>
                          {subs.map((sub) => {
                            const SubIcon = iconMap[sub.icon || 'Cog'] || Cog;
                            return (
                              <Link
                                key={sub.id}
                                to={`/shop?category=${sub.id}`}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                              >
                                <SubIcon className="h-4 w-4 shrink-0" />
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
    </div>
  );
};

export default Categories;
