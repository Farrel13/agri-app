import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Hash password standar untuk akun testing
  const hashedPassword = await bcrypt.hash("password123", 10);

  // Buat User Petani
  const petani = await prisma.user.upsert({
    where: { email: "petani@test.com" },
    update: { password: hashedPassword },
    create: {
      email: "petani@test.com",
      name: "Budi (Petani)",
      password: hashedPassword,
      role: Role.PETANI,
    },
  });

  // Buat User Hub
  const hub = await prisma.user.upsert({
    where: { email: "hub@test.com" },
    update: { password: hashedPassword },
    create: {
      email: "hub@test.com",
      name: "Sentra Hub Cisarua",
      password: hashedPassword,
      role: Role.HUB,
    },
  });

  // Buat User Restoran
  const resto = await prisma.user.upsert({
    where: { email: "resto@test.com" },
    update: { password: hashedPassword },
    create: {
      email: "resto@test.com",
      name: "Resto Sedap Rasa",
      password: hashedPassword,
      role: Role.RESTAURANT,
    },
  });

  console.log("Seeding berhasil dengan password terenkripsi!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });