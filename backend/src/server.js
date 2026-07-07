const http = require('http');
const { sendJson, readBody } = require('./http');
const db = require('./db');
const { verifyToken } = require('./auth');
const { HttpError } = require('./utils');
const routes = require('./routes');

const PORT = process.env.PORT || 4000;

function parseUrl(rawUrl) {
  const [rawPath, rawQuery] = (rawUrl || '/').split('?');
  const query = {};
  if (rawQuery) {
    for (const pair of rawQuery.split('&')) {
      if (!pair) continue;
      const idx = pair.indexOf('=');
      const k = idx === -1 ? pair : pair.slice(0, idx);
      const v = idx === -1 ? '' : pair.slice(idx + 1);
      query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return { pathname: rawPath, query };
}

function matchRoute(pattern, pathname) {
  const pk = pattern.split('/').filter(Boolean);
  const pp = pathname.split('/').filter(Boolean);
  if (pk.length !== pp.length) return null;
  const params = {};
  for (let i = 0; i < pk.length; i++) {
    if (pk[i][0] === ':') params[pk[i].slice(1)] = decodeURIComponent(pp[i]);
    else if (pk[i] !== pp[i]) return null;
  }
  return params;
}

function currentUser(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = db.get().users.find((u) => u.id === payload.sub);
  return user || null;
}

const server = http.createServer(async (req, res) => {
  const { pathname, query } = parseUrl(req.url);
  const method = req.method;

  if (method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    for (const route of routes) {
      if (route.method !== method) continue;
      const params = matchRoute(route.path, pathname);
      if (!params) continue;

      const body =
        method === 'POST' || method === 'PUT' || method === 'PATCH'
          ? await readBody(req)
          : {};

      let user = currentUser(req);
      if (route.auth) {
        if (!user) throw new HttpError(401, 'Silakan login terlebih dahulu.');
        if (route.roles && !route.roles.includes(user.role)) {
          throw new HttpError(403, 'Anda tidak memiliki akses untuk aksi ini.');
        }
      }

      const data = await route.handler({ params, query, body, user, req });
      sendJson(res, route.status || 200, data);
      return;
    }
    sendJson(res, 404, { error: 'Not found', path: pathname });
  } catch (err) {
    const status = err.status || 500;
    if (!err.status) console.error(err);
    sendJson(res, status, { error: err.message || 'Server error' });
  }
});

db.load();
const localBase = 'http' + '://' + 'localhost:' + PORT;
server.listen(PORT, () => {
  console.log('\nSirkasir API berjalan di ' + localBase);
  console.log('    Health check: ' + localBase + '/api/health\n');
});
