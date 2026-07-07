const db = require('../db');
const { verifyPassword, signToken, hashPassword } = require('../auth');
const { HttpError, uid } = require('../utils');

function publicUser(u) {
  const { password_hash, pin_hash, ...rest } = u;
  return rest;
}

module.exports = [
  {
    method: 'POST',
    path: '/api/auth/login',
    handler: async ({ body }) => {
      const email = String(body.email || '').toLowerCase();
      const user = db.get().users.find((u) => u.email.toLowerCase() === email);
      if (!user || !verifyPassword(body.password || '', user.password_hash)) {
        throw new HttpError(401, 'Email atau password salah.');
      }
      if (user.status === 'inactive') throw new HttpError(403, 'Akun nonaktif.');
      const token = signToken({ sub: user.id, role: user.role });
      return { token, user: publicUser(user) };
    },
  },
  {
    method: 'POST',
    path: '/api/auth/pin-login',
    handler: async ({ body }) => {
      const pin = String(body.pin || '');
      const user = db.get().users.find((u) => u.pin_hash && verifyPassword(pin, u.pin_hash));
      if (!user) throw new HttpError(401, 'PIN tidak dikenali.');
      if (user.status === 'inactive') throw new HttpError(403, 'Akun nonaktif.');
      const token = signToken({ sub: user.id, role: user.role });
      return { token, user: publicUser(user) };
    },
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    auth: true,
    handler: async ({ user }) => ({ user: publicUser(user) }),
  },
  {
    method: 'GET',
    path: '/api/users',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async () => db.get().users.map(publicUser),
  },
  {
    method: 'POST',
    path: '/api/users',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!name) throw new HttpError(400, 'Nama wajib diisi.');
      if (!email) throw new HttpError(400, 'Email wajib diisi.');
      if (d.users.some((u) => u.email.toLowerCase() === email))
        throw new HttpError(400, 'Email sudah dipakai.');
      if (!body.password) throw new HttpError(400, 'Password wajib diisi.');
      const role = ['owner', 'manager', 'kasir'].includes(body.role) ? body.role : 'kasir';
      const user = {
        id: uid('usr'),
        name,
        email,
        password_hash: hashPassword(String(body.password)),
        pin_hash: body.pin ? hashPassword(String(body.pin)) : null,
        role,
        status: body.status === 'inactive' ? 'inactive' : 'active',
      };
      d.users.push(user);
      db.save();
      return publicUser(user);
    },
  },
  {
    method: 'PUT',
    path: '/api/users/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const user = d.users.find((u) => u.id === params.id);
      if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan.');
      if (body.name != null) user.name = String(body.name).trim();
      if (body.email != null) {
        const email = String(body.email).trim().toLowerCase();
        if (email && d.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email))
          throw new HttpError(400, 'Email sudah dipakai.');
        user.email = email;
      }
      if (body.role != null && ['owner', 'manager', 'kasir'].includes(body.role)) user.role = body.role;
      if (body.status != null) user.status = body.status === 'inactive' ? 'inactive' : 'active';
      if (body.password) user.password_hash = hashPassword(String(body.password));
      if (body.pin) user.pin_hash = hashPassword(String(body.pin));
      db.save();
      return publicUser(user);
    },
  },
  {
    method: 'DELETE',
    path: '/api/users/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, user }) => {
      const d = db.get();
      const target = d.users.find((u) => u.id === params.id);
      if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan.');
      if (target.id === user.id) throw new HttpError(400, 'Tidak bisa menghapus akun sendiri.');
      if (target.role === 'owner' && d.users.filter((u) => u.role === 'owner').length <= 1)
        throw new HttpError(400, 'Minimal harus ada satu owner.');
      d.users = d.users.filter((u) => u.id !== target.id);
      db.save();
      return { ok: true };
    },
  },
];
