import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Store, Mail, Phone, MapPin, FileText, Save, Loader2, Building2, ImageIcon, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ShopFormData {
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  business_registration: string;
  logo_url: string;
  shop_wide_discount_percent: string;
}

const AdminSettings: React.FC = () => {
  const { shop } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ShopFormData>({
    name: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    business_registration: '',
    logo_url: '',
    shop_wide_discount_percent: '0',
  });

  useEffect(() => {
    if (shop) {
      setFormData({
        name: shop.name || '',
        description: shop.description || '',
        email: shop.email || '',
        phone: shop.phone || '',
        address: shop.address || '',
        business_registration: shop.business_registration || '',
        logo_url: shop.logo_url || '',
        shop_wide_discount_percent: String(shop.shopWideDiscountPercent ?? 0),
      });
      setLoading(false);
    }
  }, [shop]);

  const handleSave = async () => {
    if (!shop?.id) return;
    
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Shop name is required', variant: 'destructive' });
      return;
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        toast({ title: 'Error', description: 'Please enter a valid shop email', variant: 'destructive' });
        return;
      }
    }

    if (formData.phone.trim()) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length < 9 || phoneDigits.length > 15) {
        toast({ title: 'Error', description: 'Please enter a valid phone number', variant: 'destructive' });
        return;
      }
    }

    if (formData.logo_url.trim()) {
      try {
        const parsed = new URL(formData.logo_url.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('invalid protocol');
        }
      } catch (_err) {
        toast({ title: 'Error', description: 'Logo URL must be a valid http/https URL', variant: 'destructive' });
        return;
      }
    }

    const discount = Number(formData.shop_wide_discount_percent || '0');
    if (!Number.isFinite(discount) || discount < 0 || discount > 90) {
      toast({ title: 'Error', description: 'Shop-wide discount must be between 0 and 90', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await api.updateMyShop({
        name: formData.name,
        description: formData.description || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        businessRegistration: formData.business_registration || undefined,
        logoUrl: formData.logo_url || undefined,
        shopWideDiscountPercent: Math.max(0, Math.min(90, discount)),
      });
      toast({ title: 'Saved', description: 'Shop settings updated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message || 'Failed to save settings', variant: 'destructive' });
    }
    setSaving(false);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/20 text-warning border-warning/30',
      approved: 'bg-success/20 text-success border-success/30',
      rejected: 'bg-destructive/20 text-destructive border-destructive/30',
    };
    return <Badge variant="outline" className={styles[status] || ''}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

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
              <Settings className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />
              Shop Settings
            </h1>
            <p className="text-muted-foreground mt-1">Manage your shop profile and business information</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="neon-button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <div className="grid gap-6 max-w-4xl">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Shop Status</CardTitle>
              <CardDescription>Current status of your shop on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  {shop && getStatusBadge(shop.status)}
                </div>
                <Separator orientation="vertical" className="h-8 hidden sm:block" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Commission Rate</p>
                  <Badge variant="outline" className="flex items-center gap-1"><Percent className="h-3 w-3" />{shop?.commission_rate || 10}%</Badge>
                </div>
                <Separator orientation="vertical" className="h-8 hidden sm:block" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                  <p className="text-sm font-medium">{shop?.created_at && new Date(shop.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {shop?.status === 'pending' && (
                <p className="text-sm text-warning mt-4 p-3 bg-warning/10 rounded-lg border border-warning/20">Your shop is pending approval. You can add products, but they won't be visible to customers until your shop is approved.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" />Deals & Discounts</CardTitle>
              <CardDescription>Configure a shop-wide discount that applies to all your approved active products.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm">
                <Label htmlFor="shop_wide_discount_percent">Shop-wide Discount (%)</Label>
                <Input
                  id="shop_wide_discount_percent"
                  type="number"
                  min={0}
                  max={90}
                  value={formData.shop_wide_discount_percent}
                  onChange={(e) => setFormData({ ...formData, shop_wide_discount_percent: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-2">Range: 0 to 90. The higher of product discount and shop-wide discount is used.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Basic Information</CardTitle>
              <CardDescription>Your shop's public information visible to customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Shop Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your shop name" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe your shop and the products you sell..." className="mt-1" rows={3} />
              </div>
              <div>
                <Label htmlFor="logo_url" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Logo URL</Label>
                <Input id="logo_url" value={formData.logo_url} onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })} placeholder="https://..." className="mt-1" />
                {formData.logo_url && (
                  <div className="mt-2">
                    <img src={formData.logo_url} alt="Shop logo preview" className="w-24 h-24 object-cover rounded-lg border border-border" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Contact Information</CardTitle>
              <CardDescription>How customers can reach you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="shop@example.com" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+94 XX XXX XXXX" className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address" className="flex items-center gap-2"><MapPin className="h-4 w-4" />Address</Label>
                  <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Your shop or business address..." className="mt-1" rows={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Business Details</CardTitle>
              <CardDescription>Official business registration information</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="business_registration">Business Registration Number</Label>
                <Input id="business_registration" value={formData.business_registration} onChange={(e) => setFormData({ ...formData, business_registration: e.target.value })} placeholder="BR-XXXXXXXX" className="mt-1" />
                <p className="text-sm text-muted-foreground mt-2">This information is used for verification and is not publicly visible.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminSettings;
