import { defineProvider } from '@nexus/provider-template';

export const fiberMx = defineProvider({
  id: 'fibermx',
  name: 'FiberMX',
  categories: ['internet'],
  serviceAreas: ['Guadalajara'],
  capabilities: ['check_coverage', 'check_installation_date', 'build_connectivity_offer'],
});
