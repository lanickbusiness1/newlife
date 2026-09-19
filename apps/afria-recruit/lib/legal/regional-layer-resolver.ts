import type { RegionalLayerRef } from './types.js';
import { REGIONAL_LAYER_REGISTRY } from './layers/registry.js';

function isEffectiveOn(
  layer: { effectiveFrom?: string; effectiveTo?: string },
  effectiveDate: string,
): boolean {
  if (layer.effectiveFrom && layer.effectiveFrom > effectiveDate) return false;
  if (layer.effectiveTo && layer.effectiveTo < effectiveDate) return false;
  return true;
}

export function resolveRegionalLayers(
  countryCode: string,
  subject: string,
  effectiveDate: string,
): RegionalLayerRef[] {
  const normalizedCountry = countryCode.trim().toUpperCase();

  return REGIONAL_LAYER_REGISTRY
    .filter((layer) => layer.countryCodes.includes(normalizedCountry))
    .filter((layer) => layer.subjects.includes(subject))
    .filter((layer) => isEffectiveOn(layer, effectiveDate))
    .map((layer) => ({
      id: layer.id,
      organization: layer.organization,
      subjects: [...layer.subjects],
      effectiveFrom: layer.effectiveFrom,
      effectiveTo: layer.effectiveTo,
    }));
}
