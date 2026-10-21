// export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export default async function DashboardHub() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  if (session.user.role !== "HUB") {
    redirect("/");
  }

  // 1. Ambil produk yang belum diverifikasi
  const unverifiedProducts = await prisma.product.findMany({
    where: { isVerified: false },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  // 2. Ambil produk yang sudah diverifikasi (Inventaris Siap Jual)
  const verifiedProducts = await prisma.product.findMany({
    where: { isVerified: true },
    include: { user: true },
    orderBy: { updatedAt: "desc" },
  });

  // Server Action untuk verifikasi & atur harga
  async function handleVerify(formData: FormData) {
    "use server";
    const productId = formData.get("productId") as string;
    const priceHub = Number(formData.get("priceHub"));

    if (!productId || isNaN(priceHub)) return;

    await prisma.product.update({
      where: { id: productId },
      data: {
        priceHub: priceHub,
        isVerified: true,
      },
    });

    revalidatePath("/hub");
    revalidatePath("/restoran");
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Hub / Central Warehouse</h1>
        <p className="text-gray-600">Verifikasi hasil panen petani dan atur harga jual ke restoran.</p>
      </div>

      {/* Tabel 1: Menunggu Verifikasi */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-amber-600 flex items-center gap-2">
          ⏳ Menunggu Cek & Verifikasi ({unverifiedProducts.length})
        </h2>

        {unverifiedProducts.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Tidak ada antrean produk baru dari petani.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-medium border-b">
                <tr>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Petani</th>
                  <th className="py-3 px-4">Stok</th>
                  <th className="py-3 px-4">Harga Petani</th>
                  <th className="py-3 px-4">Harga Jual Hub (Rp)</th>
                  <th className="py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unverifiedProducts.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-4">{item.user?.name || "Petani"}</td>
                    <td className="py-3 px-4">{item.stock} {item.unit}</td>
                    <td className="py-3 px-4">Rp {item.priceFarmer.toLocaleString("id-ID")}</td>
                    <td className="py-3 px-4" colSpan={2}>
                      <form action={handleVerify} className="flex gap-2 items-center">
                        <input type="hidden" name="productId" value={item.id} />
                        <input
                          type="number"
                          name="priceHub"
                          placeholder="Misal: 30000"
                          required
                          min={item.priceFarmer}
                          className="w-36 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
                        >
                          Verifikasi
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tabel 2: Siap Jual ke Restoran */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-emerald-600 flex items-center gap-2">
          ✅ Inventaris Siap Jual ke Restoran ({verifiedProducts.length})
        </h2>

        {verifiedProducts.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Belum ada barang yang diverifikasi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-medium border-b">
                <tr>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Asal Petani</th>
                  <th className="py-3 px-4">Tersedia</th>
                  <th className="py-3 px-4">Harga Beli Hub</th>
                  <th className="py-3 px-4">Harga Jual Resto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {verifiedProducts.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-4">{item.user?.name || "Petani"}</td>
                    <td className="py-3 px-4">{item.stock} {item.unit}</td>
                    <td className="py-3 px-4 text-gray-500">Rp {item.priceFarmer.toLocaleString("id-ID")}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">
                      Rp {item.priceHub?.toLocaleString("id-ID")} / {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}