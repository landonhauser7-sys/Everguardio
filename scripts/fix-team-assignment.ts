import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fix() {
  // Find Landon first
  const landon = await prisma.users.findFirst({
    where: {
      first_name: 'Landon',
      last_name: 'Hauser'
    }
  });

  if (!landon) {
    console.log('Landon not found!');
    return;
  }

  console.log('Found Landon:', landon.id);

  // Assign Landon to Landons Team
  const result = await prisma.users.update({
    where: {
      id: landon.id
    },
    data: {
      team_id: '5a1b4be3-307a-41cb-81a2-9d09b93a69c5' // Landons Team ID
    }
  });

  console.log('Updated Landon Hauser to be on Landons Team');
  console.log('Result:', result.first_name, result.last_name, '- Team ID:', result.team_id);

  // Verify the team setup
  const teamMembers = await prisma.users.findMany({
    where: {
      team_id: '5a1b4be3-307a-41cb-81a2-9d09b93a69c5'
    },
    select: {
      first_name: true,
      last_name: true,
      role: true,
      status: true
    }
  });

  console.log('\nLandons Team members:');
  teamMembers.forEach(m => {
    console.log('  ' + m.first_name + ' ' + m.last_name + ' - ' + m.role + ' (' + m.status + ')');
  });

  await prisma.$disconnect();
}
fix();
