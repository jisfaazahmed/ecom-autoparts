import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Search, Check, X, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { Vehicle } from '@/types';
import { toast } from 'sonner';
import { api, ApiVehicleBrand, ApiVehicleModel, ApiVehicleVariant } from '@/lib/api';

interface VehicleSelectorProps {
  trigger?: React.ReactNode;
  onVehicleAdded?: () => void;
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({ trigger, onVehicleAdded }) => {
  const { setUserVehicle, userVehicle } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'vin' | 'manual'>('manual');
  
  // Loading states
  const [loading, setLoading] = useState(false);
  
  // Data from database
  const [brands, setBrands] = useState<ApiVehicleBrand[]>([]);
  const [models, setModels] = useState<ApiVehicleModel[]>([]);
  const [variants, setVariants] = useState<ApiVehicleVariant[]>([]);
  
  // VIN state
  const [vin, setVin] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  
  // Manual selection state
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [nickname, setNickname] = useState('');

  // Fetch brands on mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const data = await api.getVehicleBrands();
        setBrands(data || []);
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      }
    };
    fetchBrands();
  }, []);

  // Fetch models when brand changes
  useEffect(() => {
    if (!selectedBrand) {
      setModels([]);
      return;
    }
    
    const fetchModels = async () => {
      setLoading(true);
      try {
        const data = await api.getVehicleModels(selectedBrand);
        setModels(data || []);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
      setLoading(false);
    };
    fetchModels();
  }, [selectedBrand]);

  // Fetch variants when model changes
  useEffect(() => {
    if (!selectedModel) {
      setVariants([]);
      return;
    }
    
    const fetchVariants = async () => {
      setLoading(true);
      try {
        const data = await api.getVehicleVariants(selectedModel);
        setVariants(data || []);
      } catch (error) {
        console.error('Failed to fetch variants:', error);
      }
      setLoading(false);
    };
    fetchVariants();
  }, [selectedModel]);

  const selectedBrandData = brands.find((b) => b.id === selectedBrand);
  const selectedModelData = models.find((m) => m.id === selectedModel);
  const selectedVariantData = variants.find((v) => v.id === selectedVariant);

  // Generate years array based on variant
  const getYears = () => {
    if (!selectedVariantData) return [];
    const endYear = selectedVariantData.yearEnd || new Date().getFullYear();
    const years = [];
    for (let y = selectedVariantData.yearStart; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  };

  const resetSelections = () => {
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedVariant('');
    setSelectedYear('');
    setNickname('');
    setVin('');
  };

  const handleVinLookup = async () => {
    if (vin.length !== 17) {
      toast.error('VIN must be exactly 17 characters');
      return;
    }

    setVinLoading(true);
    // Mock VIN lookup - in a real app, this would call a VIN decoder API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    toast.info('VIN lookup is not yet available. Please use manual selection.');
    setVinLoading(false);
  };

  const handleManualSave = async () => {
    if (!selectedBrandData || !selectedModelData || !selectedVariantData || !selectedYear) {
      toast.error('Please complete all selections');
      return;
    }

    if (!user) {
      toast.error('Please log in to save vehicles');
      return;
    }

    setLoading(true);

    try {
      // Save to database via API
      await api.addUserVehicle({
        brandId: selectedBrand,
        modelId: selectedModel,
        variantId: selectedVariant,
        year: parseInt(selectedYear),
        ...(nickname.trim() && { nickname: nickname.trim() }),
      });

      // Also update local store for compatibility filtering
      const vehicle: Vehicle = {
        id: `${selectedBrand}-${selectedModel}-${selectedVariant}-${selectedYear}`,
        brand: selectedBrandData.name,
        model: selectedModelData.name,
        variant: selectedVariantData.name,
        year: parseInt(selectedYear),
      };

      setUserVehicle(vehicle);
      setOpen(false);
      toast.success(`Vehicle added: ${vehicle.year} ${vehicle.brand} ${vehicle.model}`);
      resetSelections();
      onVehicleAdded?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error && error.message ? error.message : 'Failed to save vehicle');
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2 border-primary/50 hover:border-primary">
            <Car className="h-4 w-4" />
            {userVehicle ? (
              <span>{userVehicle.year} {userVehicle.brand} {userVehicle.model}</span>
            ) : (
              <span>Add My Vehicle</span>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Add Your Vehicle
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'vin' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="vin" className="gap-2">
              <Search className="h-4 w-4" />
              VIN Lookup
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Car className="h-4 w-4" />
              Select Manually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vin" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="vin">Enter VIN Number</Label>
              <Input
                id="vin"
                placeholder="e.g., 1HGBH41JXMN109186"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength={17}
                className="font-mono tracking-wider bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">
                Your 17-character Vehicle Identification Number can be found on your dashboard or door jamb
              </p>
            </div>
            <Button
              onClick={handleVinLookup}
              disabled={vin.length !== 17 || vinLoading}
              className="w-full neon-button"
            >
              {vinLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Look Up Vehicle
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={selectedBrand} onValueChange={(v) => {
                setSelectedBrand(v);
                setSelectedModel('');
                setSelectedVariant('');
                setSelectedYear('');
              }}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <AnimatePresence>
              {selectedBrand && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label>Model</Label>
                  <Select value={selectedModel} onValueChange={(v) => {
                    setSelectedModel(v);
                    setSelectedVariant('');
                    setSelectedYear('');
                  }}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder={loading ? "Loading..." : "Select model"} />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Variant Selection */}
            <AnimatePresence>
              {selectedModel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label>Variant</Label>
                  <Select value={selectedVariant} onValueChange={(v) => {
                    setSelectedVariant(v);
                    setSelectedYear('');
                  }}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder={loading ? "Loading..." : "Select variant"} />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Year Selection */}
            <AnimatePresence>
              {selectedVariant && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label>Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      {getYears().map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nickname (optional) */}
            <AnimatePresence>
              {selectedYear && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label>Nickname <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    placeholder='e.g., "Daily Driver", "Weekend Car"'
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-secondary/50"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              onClick={handleManualSave}
              disabled={!selectedYear || loading}
              className="w-full neon-button"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Vehicle
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Active Vehicle Info */}
        {userVehicle && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-primary fill-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Active Vehicle</p>
                <p className="font-medium text-sm">
                  {userVehicle.year} {userVehicle.brand} {userVehicle.model} {userVehicle.variant}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VehicleSelector;
