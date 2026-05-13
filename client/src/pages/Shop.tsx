import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, Grid, List, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import Navbar from '@/components/layout/Navbar';
import ProductCard from '@/components/products/ProductCard';
import VehicleSelector from '@/components/vehicle/VehicleSelector';
import PaginationControls from '@/components/common/PaginationControls';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { api, ApiProduct, ApiCategory } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';

const Shop: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { userVehicle } = useStore();
  const { user } = useAuth();
  const searchFromUrl = searchParams.get('search') || '';
  const categoryFromUrl = searchParams.get('category') || 'all';
  
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState(searchFromUrl);
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const maxPrice = 50000;
  const [priceRange, setPriceRange] = useState([0, maxPrice]);
  const [sortBy, setSortBy] = useState('featured');
  const [showCompatibleOnly, setShowCompatibleOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Build product query params
        const productParams: Parameters<typeof api.getProducts>[0] = {
          isActive: true,
          limit: 1000,
        };

        // When compatibility filter is on, use server-side vehicle filtering
        if (showCompatibleOnly && userVehicle) {
          productParams.make = userVehicle.brand;
          productParams.model = userVehicle.model;
          productParams.year = userVehicle.year;
        }

        const [productsRes, categoriesRes] = await Promise.all([
          api.getProducts(productParams),
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
  }, [showCompatibleOnly, userVehicle]);

  useEffect(() => {
    setSearch(searchFromUrl);
    setSelectedCategory(categoryFromUrl);
  }, [searchFromUrl, categoryFromUrl]);

  const mapToProductCard = (p: ApiProduct) => {
    // Build human-readable list of compatible vehicles from model data
    const vehicleStrings: string[] = [];
    if (p.compatibleVehicleModels && p.compatibleVehicleModels.length > 0) {
      for (const m of p.compatibleVehicleModels) {
        const label = [m.brandName, m.name].filter(Boolean).join(' ');
        if (label && !vehicleStrings.includes(label)) vehicleStrings.push(label);
      }
    }

    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price,
      image: p.imageUrl || '/placeholder.svg',
      category: p.category?.name || 'Uncategorized',
      categoryId: p.categoryId,
      brand: '',
      shopId: p.shopId || '',
      shopName: p.shop?.name || '',
      stock: p.stock,
      compatibleVehicles: vehicleStrings,
      rating: p.rating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      sku: p.sku || '',
    };
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.description && p.description.toLowerCase().includes(searchLower))
      );
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }

    // Price filter
    filtered = filtered.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // Compatibility filter — when showCompatibleOnly is on, server already returns only matching products so no extra client-side filter needed.

    // Sorting
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        filtered.sort((a, b) => b.id.localeCompare(a.id));
        break;
    }

    return filtered;
  }, [products, search, selectedCategory, priceRange, sortBy]);

  const {
    paginatedItems: paginatedProducts,
    currentPage,
    totalPages,
    goToPage,
  } = usePagination(filteredProducts, { itemsPerPage: 12 });

  const isProductCompatible = (product: ApiProduct) => {
    if (!userVehicle) return true;
    // Check model-based compatibility
    const models = product.compatibleVehicleModels;
    if (!models || models.length === 0) return true;
    return models.some((m) => {
      const brandMatch = m.brandName?.toLowerCase() === userVehicle.brand.toLowerCase();
      const modelMatch = m.name?.toLowerCase() === userVehicle.model.toLowerCase();
      return brandMatch && modelMatch;
    });
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Vehicle */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">My Vehicle</Label>
        {user ? (
          <>
            <VehicleSelector />
            {userVehicle && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="compatible"
                  checked={showCompatibleOnly}
                  onCheckedChange={(checked) => setShowCompatibleOnly(checked as boolean)}
                />
                <label
                  htmlFor="compatible"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Show compatible parts only
                </label>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Login to select your vehicle</p>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Category</Label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="bg-secondary/50">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="glass-card">
            <SelectItem value="all">All Categories</SelectItem>
            {(() => {
              const parents = categories.filter((c) => !c.parentId);
              const getSubs = (parentId: string) => categories.filter((c) => c.parentId === parentId);
              return (
                <>
                  {parents.map((parent) => (
                    <React.Fragment key={parent.id}>
                      <SelectItem value={parent.id}>{parent.name}</SelectItem>
                      {getSubs(parent.id).map((sub) => (
                        <SelectItem key={sub.id} value={sub.id} className="pl-6">
                          ↳ {sub.name}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </>
              );
            })()}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Price Range: LKR {priceRange[0].toLocaleString()} - LKR {priceRange[1].toLocaleString()}
        </Label>
        <Slider
          defaultValue={priceRange}
          onValueCommit={setPriceRange}
          min={0}
          max={maxPrice}
          step={1000}
          className="py-4"
        />
      </div>

      {/* Clear Filters */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setSelectedCategory('all');
          setPriceRange([0, maxPrice]);
          setSearch('');
        }}
      >
        <X className="h-4 w-4 mr-2" />
        Clear Filters
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">
              SHOP <span className="text-primary">PARTS</span>
            </h1>
            <p className="text-muted-foreground">
              {filteredProducts.length} products found
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Filter */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="glass-card border-border/50 w-80">
                <SheetHeader>
                  <SheetTitle className="font-display">Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>

            {/* Search */}
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 bg-secondary/50"
            />

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 bg-secondary/50">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="hidden md:flex items-center border border-border/50 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {((selectedCategory && selectedCategory !== 'all') || search || (user && userVehicle)) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedCategory && selectedCategory !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {categories.find((c) => c.id === selectedCategory)?.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setSelectedCategory('all')}
                />
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="gap-1">
                Search: {search}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch('')} />
              </Badge>
            )}
            {user && userVehicle && showCompatibleOnly && (
              <Badge className="bg-primary/20 text-primary border-primary/30">
                Compatible with: {userVehicle.year} {userVehicle.brand} {userVehicle.model}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-8">
          {/* Desktop Filters */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="glass-card p-6 sticky top-24">
              <h2 className="font-display text-lg font-semibold mb-6">Filters</h2>
              <FilterContent />
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <p className="text-muted-foreground mb-4">No products found</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange([0, maxPrice]);
                    setSearch('');
                    setShowCompatibleOnly(false);
                  }}
                >
                  Clear all filters
                </Button>
              </motion.div>
            ) : (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {paginatedProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ProductCard
                      product={mapToProductCard(product)}
                      isCompatible={isProductCompatible(product)}
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {!loading && filteredProducts.length > 0 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;
