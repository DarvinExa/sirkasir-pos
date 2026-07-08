const { getSettings, updateSettings } = require('../repo');

module.exports = [
  {
    method: 'GET',
    path: '/api/health',
    handler: async () => ({
      status: 'ok',
      service: 'sirkasir-api',
      version: '0.8.0',
      time: new Date().toISOString(),
    }),
  },
  {
    method: 'GET',
    path: '/api/settings',
    auth: true,
    handler: async () => getSettings(),
  },
  {
    method: 'PUT',
    path: '/api/settings',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => updateSettings(body || {}),
  },
];
