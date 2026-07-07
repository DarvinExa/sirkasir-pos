// Route registry: auth, catalog, sales, reports, dining, back office.
const misc = require('./misc');
const auth = require('./auth');
const catalog = require('./catalog');

let extra = [];
try {
  extra = extra.concat(require('./sales'));
} catch (e) {}
try {
  extra = extra.concat(require('./reports'));
} catch (e) {}
try {
  extra = extra.concat(require('./dining'));
} catch (e) {}
try {
  extra = extra.concat(require('./backoffice'));
} catch (e) {}
try {
  extra = extra.concat(require('./loyalty'));
} catch (e) {}
try {
  extra = extra.concat(require('./promo'));
} catch (e) {}

module.exports = [...misc, ...auth, ...catalog, ...extra];
