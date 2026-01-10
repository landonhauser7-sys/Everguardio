import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const admins = await prisma.users.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, first_name: true, commission_level: true }
  });
  console.log("Admin users before:", admins);

  const result = await prisma.users.updateMany({
    where: { role: "ADMIN" },
    data: { commission_level: 130 }
  });
  console.log("Updated", result.count, "admin users to 130% commission");

  const adminsAfter = await prisma.users.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, first_name: true, commission_level: true }
  });
  console.log("Admin users after:", adminsAfter);
}

main().catch(console.error);
