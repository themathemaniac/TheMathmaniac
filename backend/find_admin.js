const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (admin) {
    console.log('Found admin:', admin.id);
  } else {
    console.log('No admin found');
  }
}
test();
