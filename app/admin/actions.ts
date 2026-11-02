"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

export async function changeUserRoleAction(userId: string, newRole: Role) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return { success: false, message: "Akses khusus Administrator." };
    }

    if (userId === session.user.id) {
      return { success: false, message: "Tidak dapat mengubah role akun admin sendiri." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    revalidatePath("/admin");
    return { success: true, message: `Role pengguna berhasil diubah ke ${newRole}!` };
  } catch (error) {
    console.error("Gagal mengubah role:", error);
    return { success: false, message: "Terjadi kesalahan saat mengubah role." };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return { success: false, message: "Akses khusus Administrator." };
    }

    if (userId === session.user.id) {
      return { success: false, message: "Tidak dapat menghapus akun admin sendiri." };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/admin");
    return { success: true, message: "Akun pengguna berhasil dihapus dari platform." };
  } catch (error) {
    console.error("Gagal menghapus user:", error);
    return { success: false, message: "Gagal menghapus akun (mungkin terkait relasi pesanan aktif)." };
  }
}
