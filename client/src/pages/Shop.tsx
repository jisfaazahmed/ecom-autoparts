import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, Grid, List, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Badge } from '@/components/ui/badge';
import { api, ApiProduct, ApiCategory } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import type { Vehicle } from '@/types';

function getProductCompatibility(
  product: ApiProduct,
  vehicle: Vehicle | null
): boolean | undefined {
  if (!vehicle) return undefined;

  const normalize = (value?: string) => String(value || '').trim().toLowerCase();
  const selectedMake = normalize(vehicle.brand);
  const selectedModel = normalize(vehicle.model);
  const selectedYear = Number(vehicle.year);
  const selectedModelId = vehicle.modelId ? String(vehicle.modelId) : '';

  const models = Array.isArray(product.compatibleVehicleModels)
    ? product.compatibleVehicleModels
    : [];
  if (models.length > 0) {
    if (selectedModelId) {
      const idMatch = models.some((m) => m?.id && String(m.id) === selectedModelId);
      if (idMatch) return true;
    }

    return models.some((m) => {
      if (typeof m !== 'object' || !m) return false;
      const nameMatches = normalize(m.name) === selectedModel;
      const brandMatches = !m.brandName || normalize(m.brandName) === selectedMake;
      return nameMatches && brandMatches;
    });
  }

  const vehicles = Array.isArray(product.compatibleVehicles)
    ? product.compatibleVehicles
    : [];
  if (vehicles.length > 0) {
    return vehicles.some((v) => {
      const makeMatches = normalize(v?.make) === selectedMake;
      const modelMatches = normalize(v?.model) === selectedModel;
      const yearMatches = !Number.isFinite(selectedYear) || Number(v?.year) === selectedYear;
      return makeMatches && modelMatches && yearMatches;
    });
  }

  // Vehicle selected but product has no fitment data — treat as not compatible.
  return false;
}

const Shop: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { userVehicle } = useStore();
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

  // Auto-enable vehicle filter when user has a saved vehicle
  useEffect(() => {
    if (userVehicle) setShowCompatibleOnly(true);
  }, [userVehicle]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesRes = await api.getCategories();
        setCategories(categoriesRes || []);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const productsRes = await api.getProducts({ limit: 1000 });
        setProducts(productsRes.data || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
        setProducts([]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    setSearch(searchFromUrl);
    setSelectedCategory(categoryFromUrl);
  }, [searchFromUrl, categoryFromUrl]);

  // If vehicle is cleared, turn off the compatible-only filter
  useEffect(() => {
    if (!userVehicle) setShowCompatibleOnly(false);
  }, [userVehicle]);

  const mapToProductCard = (p: ApiProduct) => ({
    id: p.id || p._id || '',
    name: p.name,
    description: p.description || '',
    price: p.price,
    image: p.imageUrl || p.image_url || p.image || '/placeholder.svg',
    images: p.images,
    category: p.category?.name || 'Uncategorized',
    brand: '',
    shopId: p.shopId,
    shopName: p.shop?.name || 'Unknown Shop',
    stock: p.stock,
    compatibleVehicles: p.compatibleVariants || [],
    rating: 4.5,
    reviewCount: 0,
    sku: p.sku || '',
    originalPrice: p.originalPrice,
    effectiveDiscountPercent: p.effectiveDiscountPercent,
  });

  // Single source of truth for badges + filter
  const productsWithFitment = useMemo(() => {
    return products.map((product) => ({
      product,
      isCompatible: getProductCompatibility(product, userVehicle),
    }));
  }, [products, userVehicle]);

  const filteredProducts = useMemo(() => {
    let filtered = productsWithFitment;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        ({ product: p }) =>
          p.name.toLowerCase().includes(searchLower) ||
          (!!p.description && p.description.toLowerCase().includes(searchLower))
      );
    }

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(({ product: p }) => p.categoryId === selectedCategory);
    }

    filtered = filtered.filter(
      ({ product: p }) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // Same flag used by badges: only keep products marked Compatible
    if (showCompatibleOnly) {
      filtered = filtered.filter(({ isCompatible }) => isCompatible === true);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'price-low':
        sorted.sort((a, b) => a.product.price - b.product.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.product.price - a.product.price);
        break;
      case 'newest':
        sorted.sort((a, b) =>
          String(b.product.id || '').localeCompare(String(a.product.id || ''))
        );
        break;
    }

    return sorted;
  }, [productsWithFitment, search, selectedCategory, priceRange, sortBy, showCompatibleOnly]);

  const {
    paginatedItems: paginatedProducts,
    currentPage,
    totalPages,
    goToPage,
  } = usePagination(filteredProducts, { itemsPerPage: 12 });

  const renderFilters = (switchId: string) => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">My Vehicle</Label>
        <VehicleSelector />
        {userVehicle && (
          <div className="flex items-center justify-between gap-3 mt-2">
            <Label htmlFor={switchId} className="text-sm text-muted-foreground font-normal cursor-pointer">
              Show compatible parts only
            </Label>
            <Switch
              id={switchId}
              checked={showCompatibleOnly}
              onCheckedChange={(checked) => {
                setShowCompatibleOnly(checked);
                goToPage(1);
              }}
            />
          </div>
        )}
      </div>

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
              const getSubs = (parentId: string) =>
                categories.filter((c) => c.parentId === parentId);
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

      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Price Range: LKR {priceRange[0].toLocaleString()} - LKR{' '}
          {priceRange[1].toLocaleString()}
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

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setSelectedCategory('all');
          setPriceRange([0, maxPrice]);
          setSearch('');
          setShowCompatibleOnly(false);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">
              SHOP <span className="text-primary">PARTS</span>
            </h1>
            <p className="text-muted-foreground">
              {filteredProducts.length} products found
              {showCompatibleOnly && userVehicle
                ? ` (compatible with your ${userVehicle.brand} ${userVehicle.model})`
                : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                <div className="mt-6">{renderFilters('compatible-mobile')}</div>
              </SheetContent>
            </Sheet>

            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 bg-secondary/50"
            />

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

        {((selectedCategory && selectedCategory !== 'all') ||
          search ||
          (userVehicle && showCompatibleOnly)) && (
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
            {userVehicle && showCompatibleOnly && (
              <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                Compatible with: {userVehicle.year} {userVehicle.brand} {userVehicle.model}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setShowCompatibleOnly(false)}
                />
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-8">
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="glass-card p-6 sticky top-24">
              <h2 className="font-display text-lg font-semibold mb-6">Filters</h2>
              {renderFilters('compatible-desktop')}
            </div>
          </aside>

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
                <p className="text-muted-foreground mb-4">
                  {showCompatibleOnly
                    ? 'No compatible products found for your vehicle'
                    : 'No products found'}
                </p>
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
                    : 'flex flex-col gap-3'
                }
              >
                {paginatedProducts.map(({ product, isCompatible }, i) => (
                  <motion.div
                    key={product.id || product._id || i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ProductCard
                      product={mapToProductCard(product)}
                      isCompatible={isCompatible}
                      variant={viewMode}
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
