import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, Plus, Trash2, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiUserVehicle } from '@/lib/api';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';
import VehicleSelector from '@/components/vehicle/VehicleSelector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MyVehicle: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setUserVehicle } = useStore();
  const [vehicles, setVehicles] = useState<ApiUserVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await api.getUserVehicles();
      setVehicles(data || []);
      const active = (data || []).find((v) => v.isActive);
      if (active) {
        setUserVehicle({
          id: active.id,
          brand: active.brand?.name ?? '',
          model: active.model?.name ?? '',
          year: active.year,
          registrationNumber: active.registrationNumber,
        });
      } else {
        setUserVehicle(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load vehicles',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVehicles();
  }, [user]);

  const handleSetActive = async (vehicleId: string) => {
    if (!user) return;

    try {
      await api.setActiveVehicle(vehicleId);
      const v = vehicles.find((ve) => ve.id === vehicleId);
      if (v) {
        setUserVehicle({
          id: v.id,
          brand: v.brand?.name ?? '',
          model: v.model?.name ?? '',
          year: v.year,
          registrationNumber: v.registrationNumber,
        });
      }
      toast({
        title: 'Success',
        description: 'Active vehicle updated',
      });
      fetchVehicles();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to set active vehicle',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (vehicleId: string) => {
    try {
      await api.deleteUserVehicle(vehicleId);
      toast({
        title: 'Success',
        description: 'Vehicle removed',
      });
      fetchVehicles();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete vehicle',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">My Vehicles</h1>
                {vehicles.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {vehicles.length} saved
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                Manage your saved vehicles for personalized part recommendations
              </p>
            </div>
            <VehicleSelector 
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Vehicle
                </Button>
              }
              onVehicleAdded={fetchVehicles}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : vehicles.length === 0 ? (
            <Card className="glass-card border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <Car className="relative h-16 w-16 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Vehicles Added</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Add your vehicle to get personalized part recommendations and ensure compatibility with every purchase.
                </p>
                <VehicleSelector 
                  trigger={
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Your First Vehicle
                    </Button>
                  }
                  onVehicleAdded={fetchVehicles}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vehicles.map((vehicle, index) => (
                <motion.div
                  key={vehicle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`glass-card relative overflow-hidden transition-all ${
                    vehicle.isActive ? 'border-primary ring-2 ring-primary/20' : ''
                  }`}>
                    {vehicle.isActive && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          Active
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Car className="h-5 w-5 text-primary" />
                        {`${vehicle.brand?.name} ${vehicle.model?.name}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <div className="flex justify-between">
                          <span>Brand:</span>
                          <span className="text-foreground font-medium">{vehicle.brand?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Model:</span>
                          <span className="text-foreground font-medium">{vehicle.model?.name}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Year:</span>
                          <span className="text-foreground font-medium">{vehicle.year}</span>
                        </div>
                        {vehicle.registrationNumber && (
                          <div className="flex justify-between">
                            <span>Reg. No:</span>
                            <span className="text-foreground font-mono text-xs">{vehicle.registrationNumber}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!vehicle.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSetActive(vehicle.id)}
                          >
                            Set as Active
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Vehicle?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {vehicle.brand?.name} {vehicle.model?.name} from your saved vehicles.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(vehicle.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default MyVehicle;
