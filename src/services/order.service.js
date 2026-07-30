const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');

const orderInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  },
};

/**
 * Creates an order from the user's current cart contents.
 * Runs in a DB transaction so stock checks/decrements and order creation
 * are atomic — either everything succeeds or nothing is written.
 */
async function createOrderFromCart(userId, { shippingAddress }) {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest('Your cart is empty');
    }

    // Validate stock for every item before writing anything.
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock for "${item.product.name}" (available: ${item.product.stock})`
        );
      }
    }

    const total = cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    const order = await tx.order.create({
      data: {
        userId,
        total: Number(total.toFixed(2)),
        shippingAddress,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price, // snapshot price at purchase time
          })),
        },
      },
      include: orderInclude,
    });

    // Decrement stock for each purchased product.
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Empty the cart now that the order has been placed.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  });
}

async function getUserOrders(userId, query) {
  const { page, limit, skip, take } = getPagination(query);

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return { orders, meta: buildMeta({ page, limit, total }) };
}

async function getAllOrders(query) {
  const { page, limit, skip, take } = getPagination(query);

  const where = {};
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: {
        ...orderInclude,
        user: { select: { id: true, name: true, email: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, meta: buildMeta({ page, limit, total }) };
}

/**
 * Fetches a single order. Customers may only view their own orders;
 * admins may view any order (enforced by the caller passing `userId=null`).
 */
async function getOrderById(orderId, userId = null) {
  const where = userId ? { id: orderId, userId } : { id: orderId };
  const order = await prisma.order.findFirst({
    where,
    include: {
      ...orderInclude,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

async function updateOrderStatus(orderId, status) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');

  return prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: orderInclude,
  });
}

/**
 * Used by the payment layer to flip paymentStatus (and optionally order
 * status) once PayFast confirms a payment.
 */
async function updatePaymentStatus(orderId, paymentStatus, paymentReference = undefined) {
  const data = { paymentStatus };
  if (paymentReference !== undefined) data.paymentReference = paymentReference;
  if (paymentStatus === 'PAID') data.status = 'PROCESSING';
  if (paymentStatus === 'FAILED') data.status = 'CANCELLED';

  return prisma.order.update({ where: { id: orderId }, data });
}

module.exports = {
  createOrderFromCart,
  getUserOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
};
