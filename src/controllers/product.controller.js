const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const productService = require('../services/product.service');

const listProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await productService.listProducts(req.query);
  return new ApiResponse(200, products, 'Products fetched', meta).send(res);
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  return new ApiResponse(200, product, 'Product fetched').send(res);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.file);
  return new ApiResponse(201, product, 'Product created').send(res);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body, req.file);
  return new ApiResponse(200, product, 'Product updated').send(res);
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  return new ApiResponse(200, null, 'Product deleted').send(res);
});

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
