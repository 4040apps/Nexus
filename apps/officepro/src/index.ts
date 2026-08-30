import { defineProvider } from '@nexus/provider-template';

export const officePro = defineProvider({
  id: 'officepro',
  name: 'OfficePro',
  categories: ['furniture'],
  serviceAreas: ['Guadalajara'],
  capabilities: [
    'analyze_office_requirement',
    'search_furniture',
    'build_furniture_package',
    'check_delivery',
    'request_quote',
  ],
});
