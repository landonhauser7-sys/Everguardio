import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;
const cleanedUrl = connectionString.replace(/&?channel_binding=require/g, '');
const pool = new Pool({ connectionString: cleanedUrl, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  // Get all users with their team info
  const users = await prisma.users.findMany({
    select: {
      id: true,
      first_name: true,
      last_name: true,
      role: true,
      team_id: true,
      manager_id: true,
      status: true,
      teams_users_team_idToteams: {
        select: { id: true, name: true }
      }
    }
  });

  console.log('All users and their teams:');
  users.forEach(u => {
    const teamName = u.teams_users_team_idToteams?.name || 'None';
    console.log('  ' + u.first_name + ' ' + u.last_name + ' - Role: ' + u.role + ', Status: ' + u.status + ', Team ID: ' + (u.team_id || 'None') + ', Team: ' + teamName + ', Manager ID: ' + (u.manager_id || 'None'));
  });

  // Get all teams
  const teams = await prisma.teams.findMany({
    select: { id: true, name: true }
  });
  console.log('\nAll teams:');
  teams.forEach(t => console.log('  ' + t.id + ': ' + t.name));

  await prisma.$disconnect();
}
check();
