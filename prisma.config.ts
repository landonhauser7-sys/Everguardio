import "dotenv/config";
import { defineConfig } from "prisma/config";

// Get DATABASE_URL and remove channel_binding parameter
let dbUrl = process.env["DATABASE_URL"] || "";
dbUrl = dbUrl.replace(/[&?]channel_binding=require/g, '');
dbUrl = dbUrl.replace(/&&/g, '&').replace(/\?&/g, '?').replace(/\?$/, '');

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
