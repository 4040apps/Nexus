import { defineProvider } from '@nexus/provider-template';

export const secureNow = defineProvider({
  id: 'securenow',
  name: 'SecureNow',
  categories: ['security'],
  serviceAreas: ['Guadalajara'],
  capabilities: [
    'assess_security_requirement',
    'build_security_package',
    'request_installation',
  ],
});
