import type { ApiProduct } from '@/lib/api';
import type { Vehicle } from '@/types';

/**
 * Determines whether a product is compatible with the user's selected vehicle.
 *
 * Returns:
 *  - `true`      — the product is confirmed compatible
 *  - `false`     — the product is confirmed NOT compatible (or has no fitment data)
 *  - `undefined` — no vehicle is selected, so compatibility is unknown
 */
export function getProductCompatibility(
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
