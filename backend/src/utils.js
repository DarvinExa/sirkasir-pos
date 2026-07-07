const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

function uid(prefix) {
  return `${prefix || 'id'}_${crypto.randomBytes(6).toString('hex')}`;
}

module.exports = { HttpError, uid };
