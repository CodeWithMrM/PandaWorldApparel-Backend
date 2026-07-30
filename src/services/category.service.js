const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

async function getCategoryById(id) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

async function createCategory({ name }) {
  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) throw ApiError.conflict('A category with this name already exists');
  return prisma.category.create({ data: { name } });
}

async function updateCategory(id, { name }) {
  await getCategoryById(id);
  if (name) {
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing && existing.id !== id) {
      throw ApiError.conflict('A category with this name already exists');
    }
  }
  return prisma.category.update({ where: { id }, data: { name } });
}

async function deleteCategory(id) {
  await getCategoryById(id);
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw ApiError.badRequest(
      `Cannot delete category: ${productCount} product(s) are still assigned to it`
    );
  }
  await prisma.category.delete({ where: { id } });
}

module.exports = { listCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
