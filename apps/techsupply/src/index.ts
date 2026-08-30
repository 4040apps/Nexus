import { defineProvider } from '@nexus/provider-template';

export const techSupply = defineProvider({
  id: 'techsupply',
  name: 'TechSupply',
  categories: ['computers'],
  serviceAreas: ['Guadalajara'],
  capabilities: [
    'search_computers',
    'check_inventory',
    'build_computer_package',
    'request_quote',
  ],
});
