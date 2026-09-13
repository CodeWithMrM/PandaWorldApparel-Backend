const ImageKit = require('imagekit');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const imagekit = new ImageKit({
  publicKey: env.imagekit.publicKey,
  privateKey: env.imagekit.privateKey,
  urlEndpoint: env.imagekit.urlEndpoint,
});

function getUploadAuthentication() {
  const { token, signature, expire } = imagekit.getAuthenticationParameters();
  return { token, signature, expire, publicKey: env.imagekit.publicKey, urlEndpoint: env.imagekit.urlEndpoint };
}

function assertUploadedImage(imageUrl, imageFileId) {
  if (imageUrl === undefined && imageFileId === undefined) return;
  if (!imageUrl || !imageFileId) {
    throw ApiError.badRequest('An ImageKit image URL and file ID are both required');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw ApiError.badRequest('Image upload failed: invalid ImageKit URL');
  }

  const endpointHost = new URL(env.imagekit.urlEndpoint).host;
  if (parsedUrl.protocol !== 'https:' || (parsedUrl.host !== endpointHost && parsedUrl.host !== 'ik.imagekit.io')) {
    throw ApiError.badRequest('Image upload failed: URL must be served by ImageKit');
  }
}

async function deleteFile(fileId) {
  await imagekit.deleteFile(fileId);
}

module.exports = { getUploadAuthentication, assertUploadedImage, deleteFile };
