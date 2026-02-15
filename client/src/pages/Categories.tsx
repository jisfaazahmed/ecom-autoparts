import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Cog, Disc, Zap, Car, Gauge, CircleDot, Lightbulb, Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { api, ApiCategory } from '@/lib/api';

const iconMap: Record<string, React.ElementType> = {
  Cog, Disc, Zap, Car, Armchair: Car, Gauge, CircleDot, Lightbulb
};

const Categories: React.FC = () => {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category, i) => {
              const Icon = iconMap[category.icon || 'Cog'] || Cog;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/shop?category=${category.id}`}
                    className="block glass-card p-8 group hover:border-primary/50 transition-colors h-full"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="font-display text-lg font-semibold mb-2">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.description || 'Browse products in this category'}</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;
