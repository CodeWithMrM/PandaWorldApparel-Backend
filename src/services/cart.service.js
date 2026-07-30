const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const cartInclude = {
  items: {
    include: {
      product: {
        select: { id: true, name: true, price: true, imageUrl: true, stock: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
};

/**
 * Every user is given a cart at registration time, but this guards against
 * edge cases (e.g. data created before that logic existed) by creating one
 * on demand.
 */
async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId }, include: cartInclude });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId }, include: cartInclude });
  }
  return cart;
}

function withTotals(cart) {
  const total = cart.items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  return { ...cart, itemCount: cart.items.length, total: Number(total.toFixed(2)) };
}

async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  return withTotals(cart);
}

async function addItem(userId, { productId, quantity = 1 }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound('Product not found');
  if (product.stock < quantity) {
    throw ApiError.badRequest(`Only ${product.stock} unit(s) of "${product.name}" available`);
  }

  const cart = await getOrCreateCart(userId);

  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + Number(quantity);
    if (product.stock < newQuantity) {
      throw ApiError.badRequest(`Only ${product.stock} unit(s) of "${product.name}" available`);
    }
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, quantity: Number(quantity) },
    });
  }

  return getCart(userId);
}

async function updateItem(userId, itemId, quantity) {
  const cart = await getOrCreateCart(userId);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
  if (!item) throw ApiError.notFound('Cart item not found');

  const product = await prisma.product.findUnique({ where: { id: item.productId } });
  if (product.stock < quantity) {
    throw ApiError.badRequest(`Only ${product.stock} unit(s) of "${product.name}" available`);
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: Number(quantity) } });
  return getCart(userId);
}

async function removeItem(userId, itemId) {
  const cart = await getOrCreateCart(userId);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
  if (!item) throw ApiError.notFound('Cart item not found');

  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCart(userId);
}

async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, getOrCreateCart };
