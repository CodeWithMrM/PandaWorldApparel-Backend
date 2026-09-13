const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeAdmin() {
  try {
    const user = await prisma.user.update({
      where: {
        clerkId: 'user_3J8xTKdKo8y00HSFZbzgj8DCor4',
      },
      data: {
        role: 'ADMIN',
      },
    });

    console.log('✅ User updated to ADMIN:', user);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
