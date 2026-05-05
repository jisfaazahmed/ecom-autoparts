import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layers, Plus, Search, Edit, Trash2, Loader2, ChevronRight, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Category { id: string; name: string; description?: string | null; icon?: string | null; parentId?: string | null; }

const SuperAdminCategories: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Category | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', parentId: '' });

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to fetch categories', variant: 'destructive' });
    }
    setLoading(false);
  };

  const openAddDialog = (parentId?: string) => { setEditingItem(null); setFormData({ name: '', description: '', parentId: parentId || '' }); setDialogOpen(true); };
  const openEditDialog = (category: Category) => { setEditingItem(category); setFormData({ name: category.name, description: category.description || '', parentId: category.parentId || '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { name: formData.name, description: formData.description || undefined, parentId: formData.parentId || null };
    try {
      if (editingItem) {
        await api.updateCategory(editingItem.id, data as any);
        toast({ title: 'Updated', description: 'Category updated successfully' });
      } else {
        await api.createCategory(data as any);
        toast({ title: 'Created', description: 'Category created successfully' });
      }
      setDialogOpen(false);
      fetchCategories();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save category', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setSaving(true);
    const subcategories = categories.filter(c => c.parentId === itemToDelete.id);
    if (subcategories.length > 0) { toast({ title: 'Cannot Delete', description: 'This category has subcategories. Delete them first.', variant: 'destructive' }); setSaving(false); setDeleteDialogOpen(false); return; }
    try {
      await api.deleteCategory(itemToDelete.id);
      toast({ title: 'Deleted', description: 'Category deleted successfully' });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchCategories();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete category', variant: 'destructive' });
    }
    setSaving(false);
  };

  const parentCategories = categories.filter(c => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);
  const getParentName = (parentId: string | null) => parentId ? categories.find(c => c.id === parentId)?.name : null;
  const filteredParentCategories = parentCategories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <AdminLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3"><Layers className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Part Categories</h1>
            <p className="text-muted-foreground mt-1">Manage hierarchical product categories</p>
          </div>
          <Button onClick={() => openAddDialog()} className="neon-button"><Plus className="h-4 w-4 mr-2" />Add Category</Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><FolderTree className="h-8 w-8 text-primary" /><div><p className="text-2xl font-display font-bold">{parentCategories.length}</p><p className="text-sm text-muted-foreground">Parent Categories</p></div></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><Layers className="h-8 w-8 text-purple-400" /><div><p className="text-2xl font-display font-bold">{categories.length - parentCategories.length}</p><p className="text-sm text-muted-foreground">Subcategories</p></div></CardContent></Card>
        </div>

        <div className="glass-card p-4 mb-6">
          <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search categories..." className="pl-10 bg-secondary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </div>

        <div className="space-y-4">
          {filteredParentCategories.length === 0 ? (
            <div className="glass-card p-12 text-center"><Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No categories found</p><Button onClick={() => openAddDialog()} variant="outline" className="mt-4"><Plus className="h-4 w-4 mr-2" />Add First Category</Button></div>
          ) : (
            filteredParentCategories.map(parent => {
              const subcategories = getSubcategories(parent.id);
              return (
                <div key={parent.id} className="glass-card overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">{parent.icon ? <span className="text-xl">{parent.icon}</span> : <Layers className="h-5 w-5 text-primary" />}</div>
                      <div><p className="font-semibold">{parent.name}</p>{parent.description && <p className="text-sm text-muted-foreground line-clamp-1">{parent.description}</p>}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{subcategories.length} subcategories</Badge>
                      <Button variant="ghost" size="sm" onClick={() => openAddDialog(parent.id)}><Plus className="h-4 w-4 mr-1" />Add Sub</Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(parent)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setItemToDelete(parent); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {subcategories.length > 0 && (
                    <div className="border-t border-border/50">
                      {subcategories.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between p-3 pl-6 sm:pl-14 hover:bg-secondary/20 border-b border-border/30 last:border-b-0">
                          <div className="flex items-center gap-2"><ChevronRight className="h-4 w-4 text-muted-foreground" />{sub.icon && <span>{sub.icon}</span>}<span>{sub.name}</span>{sub.description && <span className="text-sm text-muted-foreground hidden sm:inline">- {sub.description}</span>}</div>
                          <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => openEditDialog(sub)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setItemToDelete(sub); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Category' : 'Add Category'}</DialogTitle><DialogDescription>{formData.parentId ? `Adding subcategory under "${getParentName(formData.parentId)}"` : 'Create a new parent category or subcategory'}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Brakes, Engine Parts" /></div>
            <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of this category..." rows={2} /></div>
            <div>
              <Label>Parent Category</Label>
              <Select value={formData.parentId || 'none'} onValueChange={(v) => setFormData({ ...formData, parentId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None (top-level category)" /></SelectTrigger>
                <SelectContent className="glass-card"><SelectItem value="none">None (top-level category)</SelectItem>{parentCategories.filter(c => c.id !== editingItem?.id).map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>Delete Category</DialogTitle><DialogDescription>Are you sure you want to delete "{itemToDelete?.name}"? Products using this category will become uncategorized.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SuperAdminCategories;
