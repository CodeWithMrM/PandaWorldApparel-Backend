const crypto = require('crypto');
const https = require('https');
const env = require('../config/env');

/**
 * Initialize a transaction with Paystack and get the authorization URL.
 * This is the first step in the Paystack payment flow.
 */
async function initializeTransaction({ orderId, amount, userEmail, userName }) {
  return new Promise((resolve, reject) => {
    const params = JSON.stringify({
      email: userEmail,
      amount: Math.round(amount * 100), // Paystack expects amount in kobo (naira subunits)
      metadata: {
        orderId,
        userName,
      },
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.paystack.secretKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(params),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            if (result.status) {
              resolve(result.data);
            } else {
              reject(new Error(result.message || 'Failed to initialize transaction'));
            }
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

/**
 * Verify a transaction with Paystack using the reference.
 * This is called after the user completes payment on Paystack's checkout.
 */
async function verifyTransaction(reference) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${encodeURIComponent(reference)}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.paystack.secretKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            if (result.status) {
              resolve(result.data);
            } else {
              reject(new Error(result.message || 'Failed to verify transaction'));
            }
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Verify the signature of a Paystack webhook payload.
 * Paystack sends an X-Paystack-Signature header which is an HMAC-SHA512
 * of the raw request body using the secret key.
 */
function verifyWebhookSignature(rawBody, signature) {
  const hash = crypto
    .createHmac('sha512', env.paystack.secretKey)
    .update(rawBody)
    .digest('hex');

  return hash === signature;
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
