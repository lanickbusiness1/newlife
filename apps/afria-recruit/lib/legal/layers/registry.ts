import type { RegionalLayerRef } from '../types.js';

export interface RegionalLayerDefinition extends RegionalLayerRef {
  countryCodes: string[];
  sourceUrl?: string;
}

export const REGIONAL_LAYER_REGISTRY: readonly RegionalLayerDefinition[] = [
  {
    id: 'OHADA-BUSINESS-LAW',
    organization: 'OHADA',
    countryCodes: ['BJ', 'BF', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'GQ', 'GA', 'GN', 'GW', 'ML', 'NE', 'SN', 'TG'],
    subjects: ['business_law'],
    sourceUrl: 'https://www.ohada.org/',
  },
  {
    id: 'UEMOA-MODIFIED-TREATY-2003',
    organization: 'UEMOA',
    countryCodes: ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'],
    subjects: ['regional_economic_law', 'mobility'],
    effectiveFrom: '2003-01-29',
    sourceUrl: 'https://e-docucenter.uemoa.int/fr/les-dispositions-du-traite-modifie-de-luemoa',
  },
] as const;
