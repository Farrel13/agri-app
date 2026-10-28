import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Hash password standar untuk akun testing
  const hashedPassword = await bcrypt.hash("password123", 10);

  // Buat User Petani
  const petani = await prisma.user.upsert({
    where: { email: "petani@test.com" },
    update: { 
      password: hashedPassword,
      username: "petani_budi"
    },
    create: {
      email: "petani@test.com",
      username: "petani_budi",
      name: "Budi (Petani)",
      password: hashedPassword,
      role: Role.PETANI,
    },
  });

  // Buat User Hub
  const hub = await prisma.user.upsert({
    where: { email: "hub@test.com" },
    update: { 
      password: hashedPassword,
      username: "hub_cisarua"
    },
    create: {
      email: "hub@test.com",
      username: "hub_cisarua",
      name: "Sentra Hub Cisarua",
      password: hashedPassword,
      role: Role.HUB,
    },
  });

  // Buat User Restoran
  const resto = await prisma.user.upsert({
    where: { email: "resto@test.com" },
    update: { 
      password: hashedPassword,
      username: "resto_sedap"
    },
    create: {
      email: "resto@test.com",
      username: "resto_sedap",
      name: "Resto Sedap Rasa",
      password: hashedPassword,
      role: Role.RESTAURANT,
    },
  });

  console.log("Seeding user berhasil dengan password terenkripsi & username!");

  // Seeding Alamat contoh untuk Restoran (Address)
  const alamatResto = await prisma.address.upsert({
    where: { id: "addr_resto_default" },
    update: {},
    create: {
      id: "addr_resto_default",
      label: "Dapur Utama",
      recipientName: "Chef Joko",
      phoneNumber: "081234567890",
      street: "Jl. Gandaria No. 45, Kebayoran Baru",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      postalCode: "12130",
      isPrimary: true,
      userId: resto.id,
    },
  });

  // Seeding Produk Bahan Baku Petani yang sudah diverifikasi Hub
  const produk1 = await prisma.product.upsert({
    where: { id: "prod_sayur_kol" },
    update: {},
    create: {
      id: "prod_sayur_kol",
      name: "Kubis / Kol Segar",
      description: "Kol dataran tinggi Cisarua segar, daun padat dan renyah cocok untuk sop dan tumisan resto.",
      stock: 50,
      unit: "kg",
      priceFarmer: 5000,
      priceHub: 8000,
      isVerified: true,
      userId: petani.id,
      verifiedById: hub.id,
    },
  });

  const produk2 = await prisma.product.upsert({
    where: { id: "prod_tomat_ceri" },
    update: {},
    create: {
      id: "prod_tomat_ceri",
      name: "Tomat Ceri Hidroponik",
      description: "Grade A manis asam segar, cocok untuk salad dan garnish restoran.",
      stock: 30,
      unit: "kg",
      priceFarmer: 15000,
      priceHub: 22000,
      isVerified: true,
      userId: petani.id,
      verifiedById: hub.id,
    },
  });

  // Seeding Order Dummy untuk Demo Tampilan
  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber: "ORD-DEMO-001" },
  });

  if (!existingOrder) {
    const orderDemo = await prisma.order.create({
      data: {
        orderNumber: "ORD-DEMO-001",
        status: "DIPROSES_HUB",
        totalAmount: 124000,
        deliveryFee: 15000,
        finalAmount: 139000,
        notes: "Tolong kirim sebelum jam 9 pagi untuk persiapan makan siang.",
        buyerId: resto.id,
        hubId: hub.id,
        addressId: alamatResto.id,
        items: {
          create: [
            {
              productId: produk1.id,
              quantity: 10,
              pricePerUnit: 8000,
              subtotal: 80000,
            },
            {
              productId: produk2.id,
              quantity: 2,
              pricePerUnit: 22000,
              subtotal: 44000,
            },
          ],
        },
        payment: {
          create: {
            amount: 139000,
            method: "TRANSFER_BANK",
            status: "LUNAS",
            paidAt: new Date(),
          },
        },
      },
    });

    // Seeding Notifikasi
    await prisma.notification.createMany({
      data: [
        {
          userId: hub.id,
          title: "Pesanan Baru Masuk! 🛒",
          message: `Resto Sedap Rasa membuat pesanan #${orderDemo.orderNumber} senilai Rp 139.000.`,
          type: "PESANAN_BARU",
          linkUrl: "/hub/pesanan",
        },
        {
          userId: resto.id,
          title: "Pembayaran Dikonfirmasi ✅",
          message: `Pesanan #${orderDemo.orderNumber} sedang disiapkan oleh Sentra Hub Cisarua.`,
          type: "STATUS_PESANAN",
          linkUrl: "/restoran/pesanan",
        },
      ],
    });

    // Seeding Review dari Restoran
    await prisma.review.create({
      data: {
        rating: 5,
        comment: "Kualitas kubis sangat renyah dan segar! Pengantaran dari Hub tepat waktu.",
        userId: resto.id,
        productId: produk1.id,
      },
    });
  }

  console.log("Seeding data lengkap (User, Address, Product, Order, OrderItem, Payment, Review, Notification) sukses!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
