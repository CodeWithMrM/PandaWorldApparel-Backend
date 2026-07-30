const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign a JWT access token for a user.
 * @param {{id: string, role: string}} payload
 */
function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/**
 * Verify and decode a JWT. Throws if invalid/expired.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { signAccessToken, verifyAccessToken };
