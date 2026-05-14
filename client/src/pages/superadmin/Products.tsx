import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, Search, MoreVertical, Eye, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatLKR } from '@/lib/currency';
import { usePagination } from '@/hooks/usePagination';
import AdminLayout from '@/components/layout/AdminLayout';
import PaginationControls from '@/components/common/PaginationControls';
import { api, ApiProduct, ApiCategory } from '@/lib/api';

const SuperAdminProducts: React.FC = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        api.getSuperAdminProducts({}),
        api.getCategories() as Promise<{ data?: ApiCategory[] } | ApiCategory[]>,
      ]);
      // The array comes either direct or standard paged structure
      setProducts(Array.isArray(productsRes) ? productsRes : (productsRes.data || productsRes));
      setCategories(Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes.data || []));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch data.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return '-';
    return categories.find(c => c.id === categoryId)?.name || '-';
  };

  const handleUpdateStatus = async (productId: string, newStatus: 'Approved' | 'Rejected') => {
    try {
      await api.updateProductStatus(productId, newStatus);
      toast({ title: 'Status Updated', description: `Product has been ${newStatus.toLowerCase()}.` });
      setProducts(prev => prev.map(p => (p.id || p._id) === productId ? { ...p, status: newStatus } : p));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update status', variant: 'destructive' });
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filteredProducts, { itemsPerPage: 10 });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <Package className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Product Approvals
            </h1>
            <p className="text-muted-foreground mt-1">Review and approve vendor products</p>
          </div>
        </div>

        <div className="glass-card p-4 lg:p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="product-search" name="productSearch" placeholder="Search products by name or SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-background/50" />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="bg-background/50"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden lg:table-cell">Seller</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Approval</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No products found</TableCell></TableRow>
                ) : (
                  paginatedItems.map((product, index) => (
                    <TableRow key={product.id || product._id || index} className="border-border/50">
                        <TableCell><div className="font-medium">{product.name}</div></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {product.shop?.name || 'Unknown Shop'}
                        </TableCell>
                      <TableCell className="hidden md:table-cell">{product.sku || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">{product.category?.name || getCategoryName(product.categoryId)}</TableCell>
                      <TableCell className="text-right font-medium">{formatLKR(product.price)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={
                          product.status === 'Approved' ? 'bg-success/10 text-success border-success/20' : 
                          product.status === 'Rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                          'bg-warning/10 text-warning border-warning/20'
                        }>
                          {product.status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass-card">
                            <DropdownMenuItem onClick={() => handleUpdateStatus(product.id || product._id!, 'Approved')} className="cursor-pointer text-success"><CheckCircle className="h-4 w-4 mr-2" /> Approve</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(product.id || product._id!, 'Rejected')} className="cursor-pointer text-destructive"><XCircle className="h-4 w-4 mr-2" /> Reject</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-border/50 mt-4">
              <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
            </div>
          )}
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default SuperAdminProducts;
