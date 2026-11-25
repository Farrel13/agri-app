"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { checkServerActionRateLimit } from "@/lib/rate-limit";
import { logServerEvent } from "@/lib/system-logger";

export interface ExpenseInput {
  title: string;
  category?: string;
  amount: number;
  notes?: string;
  date?: string;
}

const ALLOWED_CATEGORIES = ["BIBIT_PUPUK", "OPERASIONAL", "LOGISTIK", "LAINNYA"];

export async function addExpenseAction(data: ExpenseInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "PETANI" && session.user.role !== "HUB")) {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("add_expense", session.user.id, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const title = (data.title || "").trim().slice(0, 100);
    const amount = Math.floor(Number(data.amount));
    const rawCategory = (data.category || "").trim().toUpperCase();
    const category = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : "OPERASIONAL";
    const notes = (data.notes || "").trim().slice(0, 200) || null;

    // Batasan angka untuk mencegah Integer Overflow di basis data (OWASP A04/A03)
    if (!title || isNaN(amount) || amount <= 0 || amount > 1_000_000_000) {
      return {
        success: false,
        message: "Keterangan pengeluaran dan jumlah biaya (maks Rp 1 Miliar) harus diisi dengan benar.",
      };
    }

    let parsedDate = new Date();
    if (data.date) {
      const candidateDate = new Date(data.date);
      if (!isNaN(candidateDate.getTime())) {
        parsedDate = candidateDate;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        category,
        amount,
        notes,
        date: parsedDate,
        userId: session.user.id,
      },
    });

    logServerEvent({
      severity: "INFO",
      action: "USER_ADD_EXPENSE",
      message: `User '${session.user.username}' mencatat pengeluaran '${title}' sebesar Rp ${amount.toLocaleString("id-ID")}`,
      userId: session.user.id,
      endpoint: "ServerAction:addExpenseAction",
      metadata: { expenseId: expense.id, amount, category },
    }).catch(() => {});

    if (session.user.role === "PETANI") {
      revalidatePath("/petani");
    } else if (session.user.role === "HUB") {
      revalidatePath("/hub");
      revalidatePath("/hub/pesanan");
    }

    return {
      success: true,
      message: `Pengeluaran "${title}" berhasil dicatat!`,
      expense: {
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        notes: expense.notes,
        date: expense.date.toISOString(),
      },
    };
  } catch (error) {
    console.error("Gagal menambah pengeluaran:", error);
    return { success: false, message: "Terjadi kesalahan pada server saat mencatat pengeluaran." };
  }
}

export async function deleteExpenseAction(expenseId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "PETANI" && session.user.role !== "HUB")) {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("delete_expense", session.user.id, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing || existing.userId !== session.user.id) {
      return { success: false, message: "Data pengeluaran tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    logServerEvent({
      severity: "INFO",
      action: "USER_DELETE_EXPENSE",
      message: `User '${session.user.username}' menghapus catatan pengeluaran '${existing.title}' (Rp ${existing.amount.toLocaleString("id-ID")})`,
      userId: session.user.id,
      endpoint: "ServerAction:deleteExpenseAction",
      metadata: { deletedExpenseId: expenseId, title: existing.title, amount: existing.amount },
    }).catch(() => {});

    if (session.user.role === "PETANI") {
      revalidatePath("/petani");
    } else if (session.user.role === "HUB") {
      revalidatePath("/hub");
      revalidatePath("/hub/pesanan");
    }

    return { success: true, message: "Catatan pengeluaran berhasil dihapus." };
  } catch (error) {
    console.error("Gagal menghapus pengeluaran:", error);
    return { success: false, message: "Terjadi kesalahan pada server." };
  }
}
