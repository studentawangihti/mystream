const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function generateKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 20; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10);
  const users = await prisma.user.findMany();
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        password: hashedPassword,
        ingestKey: generateKey(),
      }
    });
  }
  console.log('Reset passwords and randomized ingest keys for all users:', users.length);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
