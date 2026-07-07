const db = require('../db');

module.exports = [
  {
    method: 'GET',
    path: '/api/health',
    handler: async () => ({
      status: 'ok',
      service: 'sirkasir-api',
      version: '0.7.0',
      time: new Date().toISOString(),
    }),
  },
  {
    method: 'GET',
    path: '/api/settings',
    auth: true,
    handler: async () => db.get().settings,
  },
  {
    method: 'PUT',
    path: '/api/settings',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      d.settings = { ...d.settings, ...body };
      db.save();
      return d.settings;
    },
  },
];
