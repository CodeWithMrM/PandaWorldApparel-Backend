/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Identity/auth is owned by Clerk now, so there's nothing to seed for
// users — they're created automatically via the Clerk webhook the first
// time someone signs up. This script just seeds catalog data so you have
// something to browse/order immediately.
//
// To get an admin account:
//   1. Sign up normally through your frontend (Clerk).
//   2. In the Clerk Dashboard, open that user -> Metadata -> Public
//      metadata, and set: { "role": "ADMIN" }
//   3. Either wait for the user.updated webhook to sync it, or just make
//      any authenticated request — `authenticate` re-checks Clerk's
//      publicMetadata on every request and keeps the local row in sync.

async function main() {
  const categoryNames = ['Electronics', 'Clothing', 'Home & Kitchen'];
  const categories = {};
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = category;
  }
  console.log(`✔ Seeded ${categoryNames.length} categories`);

  const products = [
    {
      name: 'Wireless Headphones',
      description: 'Over-ear Bluetooth headphones with noise cancellation.',
      price: 899.99,
      stock: 25,
      categoryId: categories['Electronics'].id,
    },
    {
      name: 'Smart Watch',
      description: 'Fitness tracking smart watch with heart-rate monitor.',
      price: 1499.0,
      stock: 15,
      categoryId: categories['Electronics'].id,
    },
    {
      name: "Men's Denim Jacket",
      description: 'Classic fit denim jacket.',
      price: 599.0,
      stock: 40,
      categoryId: categories['Clothing'].id,
    },
    {
      name: 'Non-stick Frying Pan',
      description: '28cm non-stick frying pan, induction compatible.',
      price: 349.5,
      stock: 60,
      categoryId: categories['Home & Kitchen'].id,
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (!existing) {
      await prisma.product.create({ data: product });
    }
  }
  console.log(`✔ Seeded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
