import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Search, Check, X, Loader2, Star, Info } from 'lucide-react';
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
import { api, ApiVehicleBrand, ApiVehicleModel, ApiRegCheckVehicle, ApiUserVehicle } from '@/lib/api';

interface VehicleSelectorProps {
  trigger?: React.ReactNode;
  onVehicleAdded?: () => void;
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({ trigger, onVehicleAdded }) => {
  const { setUserVehicle, userVehicle, triggerVehicleRefresh } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'reg' | 'manual'>('manual');

  // Loading states
  const [loading, setLoading] = useState(false);

  // Data from database
  const [brands, setBrands] = useState<ApiVehicleBrand[]>([]);
  const [models, setModels] = useState<ApiVehicleModel[]>([]);


  // Registration lookup state
  const [regNumber, setRegNumber] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regVehicle, setRegVehicle] = useState<ApiRegCheckVehicle | null>(null);
  const [regNotFound, setRegNotFound] = useState<string | null>(null);
  const [regSaving, setRegSaving] = useState(false);

  // Manual selection state
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  const [savedVehicles, setSavedVehicles] = useState<ApiUserVehicle[]>([]);

  const isDuplicateVehicle = (brandId: string, modelId: string, year: number) =>
    savedVehicles.some(
      (v) => v.brandId === brandId && v.modelId === modelId && v.year === year
    );

  // Load saved vehicles when dialog opens (for duplicate check)
  useEffect(() => {
    if (!open || !user) {
      setSavedVehicles([]);
      return;
    }
    const loadSaved = async () => {
      try {
        const data = await api.getUserVehicles();
        setSavedVehicles(data || []);
      } catch {
        setSavedVehicles([]);
      }
    };
    loadSaved();
  }, [open, user]);

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



  const selectedBrandData = brands.find((b) => b.id === selectedBrand);
  const selectedModelData = models.find((m) => m.id === selectedModel);

  // Generate years array (current year down to 2000)
  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 2000; y--) {
      years.push(y);
    }
    return years;
  };

  // Validate registration number
  const validateRegNumber = (value: string): string | null => {
    const raw = value || '';

    if (raw.trim().length === 0) return 'Please enter a registration number';

    // Only allow letters, digits, spaces and dashes in the input
    if (/[^A-Za-z0-9\s-]/.test(raw)) return 'Only letters, digits, spaces and \'-\' are allowed';

    // Ensure at most one dash is present
    const dashCount = (raw.match(/-/g) || []).length;
      if (dashCount > 1) return 'Only one "-" is allowed';

    // Remove spaces and dash for core format validation
    const cleaned = raw.replace(/[\s-]/g, '');

    // Core pattern: 2-3 letters followed by exactly 4 digits
    const coreMatch = cleaned.match(/^([A-Za-z]{2,3})(\d{4})$/);
    if (!coreMatch) {
      // Provide targeted messages when possible
      const partial = cleaned.match(/^([A-Za-z]+)(\d+)$/);
      if (!partial) return 'Format: 2-3 letters followed by 4 digits (e.g., ABC-1234)';
      const [, letters, digits] = partial;
      if (letters.length < 2 || letters.length > 3) return 'Must start with 2 or 3 letters';
      if (digits.length !== 4) return 'Must end with exactly 4 digits';
      return 'Invalid registration number';
    }

    return null; // valid
  };

  const [regError, setRegError] = useState<string | null>(null);

  const resetSelections = () => {
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedYear('');
    setRegNumber('');
    setRegVehicle(null);
    setRegNotFound(null);
    setRegError(null);
  };

  const handleRegLookup = async () => {
    const error = validateRegNumber(regNumber);
    if (error) {
      setRegError(error);
      toast.error(error);
      return;
    }
    setRegError(null);

    setRegLoading(true);
    setRegVehicle(null);
    setRegNotFound(null);

    try {
      const result = await api.lookupRegistration(regNumber.trim());

      if (result.found && result.vehicle) {
        setRegVehicle(result.vehicle);
        toast.success(
          `Found: ${result.vehicle.year ? result.vehicle.year + ' ' : ''}${result.vehicle.brand.name} ${result.vehicle.model.name}`
        );
      } else {
        const message = 'message' in result ? (result as { message: string }).message : 'Vehicle not found in our system.';
        setRegNotFound(message);
        toast.error(message);
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to look up registration number'
      );
    }

    setRegLoading(false);
  };

  const handleRegSave = async () => {
    if (!regVehicle) {
      toast.error('No valid vehicle data to save');
      return;
    }

    if (!user) {
      toast.error('Please log in to save vehicles');
      return;
    }

    const year = regVehicle.year;
    if (year != null && isDuplicateVehicle(regVehicle.brand.id, regVehicle.model.id, year)) {
      toast.error('You already have this vehicle saved');
      return;
    }

    setRegSaving(true);

    try {
      const saved = await api.addUserVehicleByReg({
        registrationNumber: regVehicle.registrationNumber,
        brandId: regVehicle.brand.id,
        modelId: regVehicle.model.id,
        year: regVehicle.year ?? undefined,
      });

      const vehicle: Vehicle = {
        id: saved.id,
        brand: saved.brand?.name || regVehicle.brand.name,
        model: saved.model?.name || regVehicle.model.name,
        year: saved.year,
        registrationNumber: regVehicle.registrationNumber,
        brandId: saved.brandId ?? saved.brand?.id ?? regVehicle.brand.id,
        modelId: saved.modelId ?? saved.model?.id ?? regVehicle.model.id,
      };

      setUserVehicle(vehicle);
      setOpen(false);
      toast.success(`Vehicle added: ${vehicle.year} ${vehicle.brand} ${vehicle.model}`);
      resetSelections();
      triggerVehicleRefresh();
      onVehicleAdded?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save vehicle'
      );
    }

    setRegSaving(false);
  };

  const handleRegDecline = () => {
    setRegVehicle(null);
    setRegNotFound(null);
    setRegNumber('');
    toast.info('Vehicle declined');
  };

  const handleManualSave = async () => {
    if (!selectedBrandData || !selectedModelData || !selectedYear) {
      toast.error('Please complete all selections');
      return;
    }

    if (!user) {
      toast.error('Please log in to save vehicles');
      return;
    }

    const year = parseInt(selectedYear, 10);
    if (isDuplicateVehicle(selectedBrand, selectedModel, year)) {
      toast.error('You already have this vehicle saved');
      return;
    }

    setLoading(true);

    try {
      // Save to database via API
      await api.addUserVehicle({
        brandId: selectedBrand,
        modelId: selectedModel,
        year: parseInt(selectedYear),
      });

      // Also update local store for compatibility filtering
      const vehicle: Vehicle = {
        id: `${selectedBrand}-${selectedModel}-${selectedYear}`,
        brand: selectedBrandData.name,
        model: selectedModelData.name,
        year: parseInt(selectedYear),
        brandId: selectedBrand,
        modelId: selectedModel,
      };

      setUserVehicle(vehicle);
      setOpen(false);
      toast.success(`Vehicle added: ${vehicle.year} ${vehicle.brand} ${vehicle.model}`);
      resetSelections();
      triggerVehicleRefresh();
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'reg' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="reg" className="gap-2">
              <Search className="h-4 w-4" />
              Registration Number
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Car className="h-4 w-4" />
              Select Manually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reg" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="reg-number">Enter Registration Number</Label>
              <Input
                id="reg-number"
                placeholder="e.g., ABC-1234"
                value={regNumber}
                onChange={(e) => {
                  setRegNumber(e.target.value.toUpperCase());
                  setRegVehicle(null);
                  setRegNotFound(null);
                  setRegError(null);
                }}
                className={`font-mono tracking-wider bg-secondary/50 ${regError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {regError ? (
                <p className="text-xs text-destructive">{regError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  2–3 letters followed by 4 digits (e.g., ABC-1234)
                </p>
              )}
            </div>
            <Button
              onClick={handleRegLookup}
              disabled={!regNumber.trim() || regLoading}
              className="w-full neon-button"
            >
              {regLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Look Up Vehicle
                </>
              )}
            </Button>

            {/* Vehicle found in DB — show DB names with Accept / Decline */}
            <AnimatePresence>
              {regVehicle && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">Vehicle Found</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Brand</span>
                      <span className="font-medium">{regVehicle.brand.name}</span>
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-medium">{regVehicle.model.name}</span>
                      {regVehicle.year && (
                        <>
                          <span className="text-muted-foreground">Year</span>
                          <span className="font-medium">{regVehicle.year}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click 'Save' to save this vehicle
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleRegSave}
                      disabled={regSaving}
                      className="flex-1 neon-button"
                    >
                      {regSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleRegDecline}
                      variant="outline"
                      disabled={regSaving}
                      className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Vehicle NOT found in DB */}
            <AnimatePresence>
              {regNotFound && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Not Available</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{regNotFound}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={selectedBrand} onValueChange={(v) => {
                setSelectedBrand(v);
                setSelectedModel('');
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



            {/* Year Selection */}
            <AnimatePresence>
              {selectedModel && (
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
                  {userVehicle.year} {userVehicle.brand} {userVehicle.model}
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
