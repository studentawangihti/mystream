const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('qwertyuiop', 10);

  const dummyUsers = [
    {
      name: 'User Free',
      email: 'free@mystream.com',
      password: passwordHash,
      plan: 'free',
      ingestKey: 'awg_live_free_account_123',
    },
    {
      name: 'User Pro',
      email: 'pro@mystream.com',
      password: passwordHash,
      plan: 'pro',
      ingestKey: 'awg_live_pro_account_456',
    },
    {
      name: 'User Ultimate VIP',
      email: 'ultimate@mystream.com',
      password: passwordHash,
      plan: 'ultimate',
      ingestKey: 'awg_live_ultimate_account_789',
    },
  ];

  console.log('Seeding dummy users into SQLite database...');

  for (const user of dummyUsers) {
    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        plan: user.plan,
        ingestKey: user.ingestKey,
      },
      create: user,
    });
    console.log(`✅ Dummy User created/updated: ${upserted.email} (Plan: ${upserted.plan})`);
  }

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
