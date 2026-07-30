const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const categoryService = require('../services/category.service');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories();
  return new ApiResponse(200, categories, 'Categories fetched').send(res);
});

const getCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return new ApiResponse(200, category, 'Category fetched').send(res);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  return new ApiResponse(201, category, 'Category created').send(res);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  return new ApiResponse(200, category, 'Category updated').send(res);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  return new ApiResponse(200, null, 'Category deleted').send(res);
});

module.exports = { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
