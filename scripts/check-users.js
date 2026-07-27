const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      plan: true,
      ingestKey: true
    }
  });
  console.log('=== Database Users ===');
  console.log(users);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
