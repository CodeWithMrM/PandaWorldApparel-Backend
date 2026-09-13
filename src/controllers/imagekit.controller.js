const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const imagekitService = require('../services/imagekit.service');

const getUploadAuthentication = asyncHandler(async (req, res) => {
  const authentication = imagekitService.getUploadAuthentication();
  return new ApiResponse(200, authentication, 'ImageKit upload authentication created').send(res);
});

module.exports = { getUploadAuthentication };
