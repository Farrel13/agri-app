import { NextResponse } from "next/server"; // <-- Ubah dari next/navigation ke next/server
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { name, username, password, role } = await request.json();

    if (!name || !username || !password || !role) {
      return NextResponse.json({ message: "Semua field harus diisi" }, { status: 400 });
    }

    // Cek apakah username sudah dipakai
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ message: "Username sudah terdaftar" }, { status: 400 });
    }

    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan ke database
    await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role,
      },
    });

    return NextResponse.json({ message: "Registrasi berhasil" }, { status: 201 });
  } catch (error) {
    console.error("Error register:", error);
    return NextResponse.json({ message: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}