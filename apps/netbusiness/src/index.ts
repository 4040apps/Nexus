import { defineProvider } from '@nexus/provider-template';

export const netBusiness = defineProvider({
  id: 'netbusiness',
  name: 'NetBusiness',
  categories: ['internet'],
  serviceAreas: ['Guadalajara'],
  capabilities: ['check_coverage', 'check_installation_date', 'build_connectivity_offer'],
});
