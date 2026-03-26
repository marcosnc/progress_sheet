import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const hash = await hashPassword("admin123");
  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: hash,
    },
  });
  let tenant = await prisma.tenant.findFirst({ where: { name: "Default Tenant" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Default Tenant" },
    });
  }
  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: user.id },
    },
    update: { role: "planner" },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: "planner",
    },
  });
  console.log("Seed done:", { userId: user.id, tenantId: tenant.id });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
