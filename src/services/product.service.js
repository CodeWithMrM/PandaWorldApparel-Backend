const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const imagekitService = require('./imagekit.service');

const productInclude = { category: { select: { id: true, name: true } } };

/**
 * GET /api/products
 * Supports: pagination (page, limit), search (by name), filter (categoryId),
 * sort (sortBy=price, order=asc|desc)
 */
async function listProducts(query) {
  const { page, limit, skip, take } = getPagination(query);

  const where = {};
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  let orderBy = { createdAt: 'desc' };
  if (query.sortBy === 'price') {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    orderBy = { price: order };
  } else if (query.sortBy === 'name') {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    orderBy = { name: order };
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: productInclude, skip, take, orderBy }),
    prisma.product.count({ where }),
  ]);

  return { products, meta: buildMeta({ page, limit, total }) };
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

async function ensureCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest('Invalid categoryId: category does not exist');
}

async function createProduct(data) {
  await ensureCategoryExists(data.categoryId);
  imagekitService.assertUploadedImage(data.imageUrl, data.imageFileId);

  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description || null,
      price: data.price,
      stock: data.stock !== undefined ? Number(data.stock) : 0,
      categoryId: data.categoryId,
      imageUrl: data.imageUrl || null,
      imageFileId: data.imageFileId || null,
    },
    include: productInclude,
  });
}

async function updateProduct(id, data) {
  const existing = await getProductById(id);

  if (data.categoryId) {
    await ensureCategoryExists(data.categoryId);
  }

  const isReplacingImage = data.imageUrl !== undefined || data.imageFileId !== undefined;
  if (isReplacingImage) imagekitService.assertUploadedImage(data.imageUrl, data.imageFileId);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.stock !== undefined) updateData.stock = Number(data.stock);
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (isReplacingImage) {
    updateData.imageUrl = data.imageUrl || null;
    updateData.imageFileId = data.imageFileId || null;
  }

  const updated = await prisma.product.update({ where: { id }, data: updateData, include: productInclude });
  if (isReplacingImage && existing.imageFileId && existing.imageFileId !== updated.imageFileId) {
    imagekitService.deleteFile(existing.imageFileId).catch(() => {});
  }
  return updated;
}

async function deleteProduct(id) {
  const existing = await getProductById(id);
  await prisma.product.delete({ where: { id } });
  if (existing.imageFileId) imagekitService.deleteFile(existing.imageFileId).catch(() => {});
}

module.exports = { listProducts, getProductById, createProduct, updateProduct, deleteProduct };
