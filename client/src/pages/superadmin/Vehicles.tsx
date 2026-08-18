import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, Plus, Search, Edit, Trash2, Loader2, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface VehicleBrand { id: string; name: string; logoUrl: string | null; }
interface VehicleModel { id: string; name: string; brandId: string; brand?: VehicleBrand; }

const SuperAdminVehicles: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('brands');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VehicleBrand | VehicleModel | null>(null);
  const [itemToDelete, setItemToDelete] = useState<VehicleBrand | VehicleModel | null>(null);
  const [formData, setFormData] = useState({ name: '', brandId: '' });
  const [logoLoadErrors, setLogoLoadErrors] = useState<Set<string>>(new Set());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setLogoLoadErrors(new Set());
    try {
      const [brandsData, modelsData] = await Promise.all([
        api.getVehicleBrands(),
        api.getAllVehicleModels()
      ]);
      setBrands(brandsData as VehicleBrand[]);
      setModels(modelsData as VehicleModel[]);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
    setLoading(false);
  };

  const openAddDialog = () => { setEditingItem(null); setFormData({ name: '', brandId: brandFilter !== 'all' ? brandFilter : '' }); setDialogOpen(true); };
  const openEditDialog = (item: VehicleBrand | VehicleModel) => { setEditingItem(item); setFormData({ name: item.name, brandId: 'brandId' in item ? item.brandId || '' : '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);

    try {
      if (activeTab === 'brands') {
        const data = { name: formData.name };
        if (editingItem) {
          await api.updateVehicleBrand(editingItem.id, data);
        } else {
          await api.createVehicleBrand(data);
        }
        toast({ title: editingItem ? 'Updated' : 'Created', description: `Brand ${editingItem ? 'updated' : 'created'} successfully` });
      } else if (activeTab === 'models') {
        if (!formData.brandId) { toast({ title: 'Error', description: 'Please select a brand', variant: 'destructive' }); setSaving(false); return; }
        const data = { name: formData.name, brandId: formData.brandId };
        if (editingItem) {
          await api.updateVehicleModel(editingItem.id, data);
        } else {
          await api.createVehicleModel(data);
        }
        toast({ title: editingItem ? 'Updated' : 'Created', description: `Model ${editingItem ? 'updated' : 'created'} successfully` });
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setSaving(true);
    try {
      if (activeTab === 'brands') {
        await api.deleteVehicleBrand(itemToDelete.id);
      } else {
        await api.deleteVehicleModel(itemToDelete.id);
      }
      toast({ title: 'Deleted', description: 'Item deleted successfully' });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
    setSaving(false);
  };

  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredModels = models.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) && (brandFilter === 'all' || m.brandId === brandFilter));

  if (loading) return <AdminLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3"><Car className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Vehicle Database</h1>
            <p className="text-muted-foreground mt-1">Manage the master vehicle compatibility database</p>
          </div>
          <Button onClick={openAddDialog} className="neon-button"><Plus className="h-4 w-4 mr-2" />Add {activeTab === 'brands' ? 'Brand' : 'Model'}</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-6">
          <Card className="glass-card"><CardContent className="p-3 lg:p-4 flex items-center gap-3"><Building className="h-6 w-6 lg:h-8 lg:w-8 text-primary" /><div><p className="text-xl lg:text-2xl font-display font-bold">{brands.length}</p><p className="text-xs lg:text-sm text-muted-foreground">Brands</p></div></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-3 lg:p-4 flex items-center gap-3"><Car className="h-6 w-6 lg:h-8 lg:w-8 text-purple-400" /><div><p className="text-xl lg:text-2xl font-display font-bold">{models.length}</p><p className="text-xs lg:text-sm text-muted-foreground">Models</p></div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <TabsList className="glass-card">
              <TabsTrigger value="brands" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Brands</TabsTrigger>
              <TabsTrigger value="models" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Models</TabsTrigger>
            </TabsList>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-10 w-full sm:w-64 bg-secondary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
              {activeTab === 'models' && <Select value={brandFilter} onValueChange={setBrandFilter}><SelectTrigger className="w-full sm:w-40 bg-secondary/50"><SelectValue placeholder="All Brands" /></SelectTrigger><SelectContent className="glass-card"><SelectItem value="all">All Brands</SelectItem>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>}
            </div>
          </div>

          <TabsContent value="brands">
            <div className="glass-card overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-border/50"><TableHead>Brand</TableHead><TableHead className="hidden sm:table-cell">Models</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredBrands.map(brand => {
                    const brandModels = models.filter(m => m.brandId === brand.id);
                    return (
                      <TableRow key={brand.id} className="border-border/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden shrink-0">
                              {brand.logoUrl && !logoLoadErrors.has(brand.logoUrl) ? (
                                <img
                                  src={brand.logoUrl}
                                  alt=""
                                  className="w-full h-full object-contain p-1"
                                  onError={() => setLogoLoadErrors((s) => new Set(s).add(brand.logoUrl!))}
                                />
                              ) : (
                                <Building className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-medium">{brand.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline">{brandModels.length}</Badge></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEditDialog(brand)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setItemToDelete(brand); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="models">
            <div className="glass-card overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-border/50"><TableHead>Model</TableHead><TableHead>Brand</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredModels.map(model => (
                    <TableRow key={model.id} className="border-border/50">
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell><Badge variant="secondary">{model.brand?.name}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEditDialog(model)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setItemToDelete(model); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'Add'} {activeTab === 'brands' ? 'Brand' : 'Model'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={activeTab === 'brands' ? 'e.g., Toyota' : 'e.g., Corolla'} /></div>
            {activeTab === 'models' && <div><Label>Brand *</Label><Select value={formData.brandId} onValueChange={(v) => setFormData({ ...formData, brandId: v })}><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger><SelectContent className="glass-card">{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="py-4 text-muted-foreground">Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SuperAdminVehicles;
