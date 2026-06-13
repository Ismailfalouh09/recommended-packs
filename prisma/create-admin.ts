import 'dotenv/config';
import { AdminRole, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME?.trim() || 'Store Owner';

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined before creating an admin.');
}

if (!email || !password) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be defined.');
}

const adminEmail = email;
const adminPassword = password;

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      fullName,
      passwordHash,
      role: AdminRole.OWNER,
      isActive: true,
    },
    create: {
      email: adminEmail,
      fullName,
      passwordHash,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  console.log(
    `Admin user ready: ${admin.email} (${admin.role}, active=${admin.isActive})`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
