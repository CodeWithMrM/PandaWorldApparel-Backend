const crypto = require('crypto');
const env = require('../config/env');

/**
 * PayFast requires a signature (MD5 hash) generated from all posted
 * (non-empty) fields, in the exact order they are added, URL-encoded with
 * spaces as '+', and with the passphrase appended if configured.
 * Docs: https://developers.payfast.co.za/docs#step_1_form_fields
 */
function generateSignature(data, passphrase = '') {
  let pairs = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(
      ([key, value]) =>
        `${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`
    );

  let queryString = pairs.join('&');

  if (passphrase) {
    queryString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }

  return crypto.createHash('md5').update(queryString).digest('hex');
}

/**
 * Builds the full set of PayFast payment fields for an order, including
 * the signature. The frontend/browser should POST (or be redirected via a
 * generated form) these fields to the PayFast `process` endpoint.
 */
function buildPaymentPayload({ order, user }) {
  const data = {
    merchant_id: env.payfast.merchantId,
    merchant_key: env.payfast.merchantKey,
    return_url: `${env.appUrl}/api/payments/success`,
    cancel_url: `${env.appUrl}/api/payments/cancel`,
    notify_url: `${env.appUrl}/api/payments/notify`,
    name_first: user.name?.split(' ')[0] || user.name,
    email_address: user.email,
    m_payment_id: order.id,
    amount: Number(order.total).toFixed(2),
    item_name: `Order #${order.id}`,
  };

  data.signature = generateSignature(data, env.payfast.passphrase);

  return data;
}

/**
 * The URL to which the payment form fields should be POSTed.
 */
function getPayfastProcessUrl() {
  return `https://${env.payfast.host}/eng/process`;
}

/**
 * Validates an Instant Transaction Notification (ITN) payload's signature.
 */
function verifyItnSignature(body) {
  const { signature, ...rest } = body;
  const expected = generateSignature(rest, env.payfast.passphrase);
  return expected === signature;
}

module.exports = {
  generateSignature,
  buildPaymentPayload,
  getPayfastProcessUrl,
  verifyItnSignature,
};
