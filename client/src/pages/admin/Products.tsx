import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Search, MoreVertical, Edit, Trash2, Eye, EyeOff, Loader2, ImagePlus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import AdminLayout from '@/components/layout/AdminLayout';
import { ImageUpload } from '@/components/ui/image-upload';
import PaginationControls from '@/components/common/PaginationControls';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiProduct, ApiCategory, ApiVehicleVariant } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR } from '@/lib/currency';
import { usePagination } from '@/hooks/usePagination';

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  stock: '',
  sku: '',
  category_id: '',
  compatible_variants: [] as string[],
  image_url: '',
  product_discount_percent: '0',
};

const AdminProducts: React.FC = () => {
  const { shop } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [variants, setVariants] = useState<ApiVehicleVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<ApiProduct | null>(null);
  const [formData, setFormData] = useState(emptyProduct);

  useEffect(() => {
    if (shop?.id) fetchData();
  }, [shop?.id]);

  const fetchData = async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const [productsRes, categoriesRes, variantsRes] = await Promise.all([
        api.getProducts({ shop: shop.id }),
        api.getCategories(),
        api.getAllVehicleVariants(),
      ]);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes || []);
      setVariants(variantsRes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingProduct(null);
    setFormData(emptyProduct);
    setProductDialogOpen(true);
  };

  const openEditDialog = (product: ApiProduct) => {
    setEditingProduct(product);
    // Populate compatible_variant (variant IDs)
    const variantIds = (product.compatibleVehicleVariants || []).map(v =>
      typeof v === 'string' ? v : v.id
    );
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      sku: product.sku || '',
      category_id: product.categoryId || '',
      compatible_variants: variantIds.length > 0 ? variantIds : (product.compatibleVariants || []),
      image_url: product.imageUrl || '',
      product_discount_percent: String(product.productDiscountPercent ?? 0),
    });
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!shop?.id || !formData.name || !formData.price) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    const price = Number(formData.price);
    const stock = Number(formData.stock || '0');
    const discount = Number(formData.product_discount_percent || '0');

    if (!Number.isFinite(price) || price <= 0) {
      toast({ title: 'Error', description: 'Price must be a valid number greater than 0', variant: 'destructive' });
      return;
    }

    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      toast({ title: 'Error', description: 'Stock must be a whole number 0 or greater', variant: 'destructive' });
      return;
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > 90) {
      toast({ title: 'Error', description: 'Product discount must be between 0 and 90', variant: 'destructive' });
      return;
    }

    if (formData.sku && formData.sku.trim().length > 64) {
      toast({ title: 'Error', description: 'SKU cannot exceed 64 characters', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const productData = {
      name: formData.name,
      description: formData.description || null,
      price,
      stock,
      sku: formData.sku || null,
      categoryId: formData.category_id || null,
      compatibleVariants: formData.compatible_variants.length > 0 ? formData.compatible_variants : undefined,
      imageUrl: formData.image_url || null,
      productDiscountPercent: Math.max(0, Math.min(90, discount)),
    };

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productData as unknown as Parameters<typeof api.updateProduct>[1]);
        toast({ title: 'Success', description: 'Product updated successfully' });
      } else {
        await api.createProduct({ ...productData, shopId: shop.id, isActive: true } as unknown as Parameters<typeof api.createProduct>[0]);
        toast({ title: 'Success', description: 'Product added successfully' });
      }
      setProductDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save product', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setSaving(true);
    try {
      await api.deleteProduct(productToDelete.id);
      toast({ title: 'Deleted', description: 'Product has been deleted' });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete product', variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleProductActive = async (product: ApiProduct) => {
    try {
      await api.updateProduct(product.id, { isActive: !product.isActive });
      setProducts(products.map(p => p.id === product.id ? { ...p, isActive: !p.isActive } : p));
      toast({ title: product.isActive ? 'Deactivated' : 'Activated', description: `Product is now ${product.isActive ? 'hidden' : 'visible'}` });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update product', variant: 'destructive' });
    }
  };

  const toggleVariant = (variantId: string) => {
    setFormData(prev => ({
      ...prev,
      compatible_variants: prev.compatible_variants.includes(variantId)
        ? prev.compatible_variants.filter(v => v !== variantId)
        : [...prev.compatible_variants, variantId],
    }));
  };

  const parentCategories = categories.filter(c => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);
  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return '-';
    return categories.find(c => c.id === categoryId)?.name || '-';
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && product.isActive) ||
      (statusFilter === 'inactive' && !product.isActive);
    return matchesSearch && matchesStatus;
  });

  const { paginatedItems: paginatedProducts, currentPage, totalPages, goToPage } = usePagination(filteredProducts, { itemsPerPage: 10 });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <Package className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Products
            </h1>
            <p className="text-muted-foreground mt-1">Manage your product inventory ({products.length} total)</p>
          </div>
          <Button onClick={openAddDialog} className="neon-button"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
        </div>

        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or SKU..." className="pl-10 bg-secondary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-40 bg-secondary/50"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="glass-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="hidden md:table-cell">SKU</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Stock</TableHead>
                <TableHead className="text-center">Approval</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">{searchQuery || statusFilter !== 'all' ? 'No products match your filters' : 'No products yet. Add your first product!'}</TableCell></TableRow>
              ) : (
                paginatedProducts.map((product, i) => (
                  <TableRow key={product.id || `temp-${i}`} className="border-border/50">
                    <TableCell>
                      <div className="w-12 h-12 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImagePlus className="h-5 w-5 text-muted-foreground" /></div>}
                      </div>
                    </TableCell>
                    <TableCell><div className="min-w-0"><p className="font-medium truncate">{product.name}</p>{product.description && <p className="text-sm text-muted-foreground line-clamp-1 hidden sm:block">{product.description}</p>}</div></TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground hidden md:table-cell">{product.sku || '-'}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{getCategoryName(product.categoryId)}</TableCell>
                    <TableCell className="text-right font-medium">{formatLKR(product.price)}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <Badge variant="outline" className={product.stock === 0 ? 'text-destructive border-destructive/30' : product.stock < 10 ? 'text-warning border-warning/30' : 'text-success border-success/30'}>{product.stock}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline" className={
                          product.status === 'Approved' ? 'bg-success/10 text-success border-success/20' : 
                          product.status === 'Rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                          'bg-warning/10 text-warning border-warning/20'
                        }>
                          {product.status || 'Pending'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-center"><Switch checked={product.isActive} onCheckedChange={() => toggleProductActive(product)} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card">
                          <DropdownMenuItem onClick={() => openEditDialog(product)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleProductActive(product)}>{product.isActive ? <><EyeOff className="h-4 w-4 mr-2" />Deactivate</> : <><Eye className="h-4 w-4 mr-2" />Activate</>}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setProductToDelete(product); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="p-4 border-t border-border/50"><PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} /></div>
        </div>
      </motion.div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="glass-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription>{editingProduct ? 'Update the product details below' : 'Fill in the product details to add it to your inventory'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Product Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Brake Pad Set" /></div>
            <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the product..." rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Price (LKR) *</Label><Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" /></div>
              <div><Label>Stock Quantity</Label><Input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} placeholder="0" /></div>
            </div>
            <div>
              <Label>Product Discount (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={formData.product_discount_percent}
                onChange={(e) => setFormData({ ...formData, product_discount_percent: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Applied on top of your base product price. Shop-wide discount can also apply from Settings.</p>
            </div>
            <div><Label>SKU</Label><Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="e.g., BP-001" /></div>
            <div>
              <Label>Product Image</Label>
              <ImageUpload value={formData.image_url} onChange={(url) => setFormData({ ...formData, image_url: url })} bucket="product-images" folder={shop?.id || ''} disabled={saving} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent className="glass-card max-h-60">
                  {parentCategories.map(parent => (
                    <React.Fragment key={parent.id}>
                      <SelectItem value={parent.id} className="font-semibold">{parent.name}</SelectItem>
                      {getSubcategories(parent.id).map(sub => <SelectItem key={sub.id} value={sub.id} className="pl-6">↳ {sub.name}</SelectItem>)}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Compatible Vehicles ({formData.compatible_variants.length} selected)</Label>
              <ScrollArea className="h-48 border rounded-lg p-2 mt-2">
                {variants.map(v => {
                  const brandName = v.model?.brandName || '';
                  const modelName = v.model?.name || '';
                  const label = `${brandName} ${modelName} ${v.name} (${v.yearStart}-${v.yearEnd || 'Present'})`;
                  return (
                    <div key={v.id} className="flex items-center space-x-2 py-1">
                      <Checkbox id={`edit-${v.id}`} checked={formData.compatible_variants.includes(v.id)} onCheckedChange={() => toggleVariant(v.id)} />
                      <label htmlFor={`edit-${v.id}`} className="text-sm cursor-pointer">{label}</label>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProduct} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingProduct ? 'Update Product' : 'Add Product'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProducts;
