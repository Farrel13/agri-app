import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const {
      name,
      email,
      username,
      password,
      role,
      phoneNumber,
      street,
      city,
      province,
      postalCode,
    } = await request.json();

    if (!name || !email || !username || !password || !role) {
      return NextResponse.json({ message: "Semua data akun wajib diisi." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Format email tidak valid." }, { status: 400 });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          message:
            "Password harus minimal 8 karakter dan kombinasi huruf besar, kecil, angka, serta simbol khusus.",
        },
        { status: 400 }
      );
    }

    // Cek apakah username sudah dipakai
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ message: "Username sudah terdaftar." }, { status: 400 });
    }

    // Cek apakah email sudah dipakai
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json({ message: "Alamat email sudah digunakan." }, { status: 400 });
    }

    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan data User
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        role,
      },
    });

    // Jika data alamat diisi, buat entitas Address primer
    if (street && city) {
      const defaultLabel =
        role === "RESTAURANT"
          ? "Dapur Utama"
          : role === "HUB"
          ? "Gudang Hub"
          : "Lokasi Lahan Tani";

      await prisma.address.create({
        data: {
          label: defaultLabel,
          recipientName: name,
          phoneNumber: phoneNumber || "081234567890",
          street,
          city,
          province: province || "DKI Jakarta",
          postalCode: postalCode || null,
          isPrimary: true,
          userId: newUser.id,
        },
      });
    }

    return NextResponse.json({ message: "Registrasi akun berhasil!" }, { status: 201 });
  } catch (error) {
    console.error("Error register:", error);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
