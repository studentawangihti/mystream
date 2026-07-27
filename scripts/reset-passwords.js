const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10);
  const result = await prisma.user.updateMany({
    data: {
      password: hashedPassword
    }
  });
  console.log('Updated users count:', result.count);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
