const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const defaultPasswordHash = await bcrypt.hash('qwertyuiop', 10);
  const adminPasswordHash = await bcrypt.hash('password123', 10);

  const dummyUsers = [
    {
      name: 'Super Admin',
      email: 'admin@mystream.com',
      password: adminPasswordHash,
      role: 'admin',
      plan: 'ultimate',
      ingestKey: 'awg_live_super_admin_key_999',
    },
    {
      name: 'User Free',
      email: 'free@mystream.com',
      password: defaultPasswordHash,
      role: 'user',
      plan: 'free',
      ingestKey: 'awg_live_free_account_123',
    },
    {
      name: 'User Pro',
      email: 'pro@mystream.com',
      password: defaultPasswordHash,
      role: 'user',
      plan: 'pro',
      ingestKey: 'awg_live_pro_account_456',
    },
    {
      name: 'User Ultimate VIP',
      email: 'ultimate@mystream.com',
      password: defaultPasswordHash,
      role: 'user',
      plan: 'ultimate',
      ingestKey: 'awg_live_ultimate_account_789',
    },
  ];

  console.log('Seeding admin and dummy users into SQLite database...');

  for (const user of dummyUsers) {
    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        role: user.role,
        plan: user.plan,
        ingestKey: user.ingestKey,
      },
      create: user,
    });
    console.log(`✅ User created/updated: ${upserted.email} (Role: ${upserted.role}, Plan: ${upserted.plan})`);
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
