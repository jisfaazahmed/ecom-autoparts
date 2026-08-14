import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Save, Loader2, ArrowLeft, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import {
  normalizeWhitespace,
  normalizeSriLankanPhone,
  normalizeSriLankanPostalCode,
  isValidSriLankanPersonName,
  isValidSriLankanPhone,
  isValidSriLankanAddress,
  isValidSriLankanDistrict,
  isValidSriLankanPostalCode,
  SRI_LANKA_DISTRICTS,
  resolveSriLankanDistrict,
} from '@/lib/sriLankaValidation';

const profileSchema = z.object({
  fullName: z.string().transform(normalizeWhitespace),
  phone: z.string().transform(normalizeSriLankanPhone),
  address: z.string().transform(normalizeWhitespace),
  city: z.string().transform(normalizeWhitespace),
  postalCode: z.string().transform(normalizeSriLankanPostalCode),
}).superRefine((value, ctx) => {
  if (!isValidSriLankanPersonName(value.fullName)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fullName'],
      message: 'Full name can only include letters, spaces, periods, apostrophes, and hyphens',
    });
  }

  if (value.phone && !isValidSriLankanPhone(value.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone'],
      message: 'Please enter a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567)',
    });
  }

  const hasAnyAddressField = Boolean(value.address || value.city || value.postalCode);
  if (hasAnyAddressField) {
    if (!value.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'Address is required when updating location details',
      });
    }
    if (!value.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'City is required when updating location details',
      });
    }
    if (!value.postalCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postalCode'],
        message: 'Postal code is required when updating location details',
      });
    }
  }

  if (value.address && !isValidSriLankanAddress(value.address)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message: 'Please enter a complete Sri Lankan street address (8-160 characters)',
    });
  }

  if (value.city && !isValidSriLankanDistrict(value.city)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['city'],
      message: 'Please select a valid Sri Lankan district',
    });
  }

  if (value.postalCode && !isValidSriLankanPostalCode(value.postalCode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['postalCode'],
      message: 'Please enter a valid Sri Lankan postal code (5 digits)',
    });
  }
});

const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
  });

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setAvatarUploading(true);
    try {
      const imageUrl = await api.uploadFile(file, 'avatars');
      await api.updateProfile({ avatarUrl: imageUrl });
      await refreshProfile();
      toast({
        title: 'Profile Photo Updated',
        description: 'Your profile image has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error && error.message ? error.message : 'Failed to upload profile image',
        variant: 'destructive',
      });
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.full_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: resolveSriLankanDistrict(profile.city || '') || '',
        postalCode: profile.postal_code || '',
      });
    }
  }, [profile]);

  const updateFormField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const normalizedForm = profileSchema.parse(form);
      setForm(normalizedForm);

      if (!user) return;

      setLoading(true);

      await api.updateProfile({
        fullName: normalizedForm.fullName,
        phone: normalizedForm.phone || undefined,
        address: normalizedForm.address || undefined,
        city: normalizedForm.city || undefined,
        postalCode: normalizedForm.postalCode || undefined,
      });

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved successfully.',
      });
      refreshProfile();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) fieldErrors[error.path[0].toString()] = error.message;
        });
        setErrors(fieldErrors);
        return;
      }

      if (!user) return;

      setLoading(true);

      try {
        await api.updateProfile({
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
        });

        toast({
          title: 'Profile Updated',
          description: 'Your profile has been saved successfully.',
        });
        refreshProfile();
      } catch (error: unknown) {
        toast({
          title: 'Error',
          description: err instanceof Error && err.message ? err.message : 'Failed to update profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
  };

    const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});

      const currentPassword = passwordForm.currentPassword.trim();
      const newPassword = passwordForm.newPassword.trim();
      const confirmPassword = passwordForm.confirmPassword.trim();

      if (!currentPassword) {
        setErrors({ currentPassword: 'Current password is required' });
        return;
      }
      if (!newPassword) {
        setErrors({ newPassword: 'New password is required' });
        return;
      }
      if (newPassword.length < 6) {
        setErrors({ newPassword: 'New password must be at least 6 characters' });
        return;
      }
      if (newPassword === currentPassword) {
        setErrors({ newPassword: 'New password must be different from current password' });
        return;
      }
      if (!confirmPassword) {
        setErrors({ confirmPassword: 'Please confirm your new password' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' });
        return;
      }

      setPasswordLoading(true);
      try {
        await api.changePassword(currentPassword, newPassword);
        toast({
          title: 'Password Changed',
          description: 'Your password has been updated successfully.',
        });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } catch (error: unknown) {
        toast({
          title: 'Error',
          description: error instanceof Error && error.message ? error.message : 'Failed to change password',
          variant: 'destructive',
        });
      }
      setPasswordLoading(false);
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container py-8 max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <Avatar className="h-24 w-24 border-4 border-primary/20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {getInitials(form.fullName || 'U')}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                  {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={avatarUploading}
                  />
                </label>
              </div>
              <h1 className="font-display text-3xl font-bold">My Profile</h1>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={form.fullName}
                      onChange={(e) => updateFormField('fullName', e.target.value)}
                      className="bg-secondary/30"
                    />
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={user?.email || ''}
                        disabled
                        className="pl-10 bg-secondary/50 opacity-70"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="+94 77 123 4567"
                        value={form.phone}
                        onChange={(e) => updateFormField('phone', e.target.value)}
                        className="pl-10 bg-secondary/30"
                      />
                    </div>
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Address Information */}
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  Default Shipping Address
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main Street, Apt 4B"
                      value={form.address}
                      onChange={(e) => updateFormField('address', e.target.value)}
                      className="bg-secondary/30"
                    />
                    {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Select
                        value={form.city}
                        onValueChange={(value) => updateFormField('city', value)}
                      >
                        <SelectTrigger id="city" className="bg-secondary/30">
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                        <SelectContent>
                          {SRI_LANKA_DISTRICTS.map((district) => (
                            <SelectItem key={district} value={district}>{district}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        placeholder="10000"
                        value={form.postalCode}
                        onChange={(e) => updateFormField('postalCode', e.target.value)}
                        className="bg-secondary/30"
                      />
                      {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Submit Button */}
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </form>

            {/* Change Password */}
            <form onSubmit={handlePasswordChange} className="glass-card rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-primary" />
                  Change Password
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="currentPassword"
                        type={showPasswords.current ? 'text' : 'password'}
                        placeholder="Enter current password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="pl-10 pr-10 bg-secondary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showPasswords.new ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="pl-10 pr-10 bg-secondary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPasswords.confirm ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="pl-10 pr-10 bg-secondary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={passwordLoading}>
                {passwordLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Change Password
              </Button>
            </form>

            {/* Quick Links */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/orders" className="flex-1">
                <Button variant="outline" className="w-full">
                  View Order History
                </Button>
              </Link>
              <Link to="/my-vehicle" className="flex-1">
                <Button variant="outline" className="w-full">
                  Manage My Vehicle
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

export default Profile;
