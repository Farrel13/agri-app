"use client";

import { useState } from "react";
import { verifyProductAction, updateStoreProductAction } from "./actions";

interface Product {
  id: string;
  name: string;
  description?: string | null;
  stock: number;
  unit: string;
  priceFarmer: number;
  priceHub: number | null;
  isVerified: boolean;
  imageUrl?: string | null;
  imageExpiresAt?: Date | string | null;
  createdAt: Date | string;
  user?: { id: string; name: string | null } | null;
  verifiedById?: string | null;
}

interface HubClientProps {
  unverifiedProducts: Product[];
  myStoreProducts: Product[];
  hubUser: { id: string; name: string };
}

export default function HubClient({
  unverifiedProducts,
  myStoreProducts,
  hubUser,
}: HubClientProps) {
  const [activeTab, setActiveTab] = useState<"VERIFIKASI" | "ETALASE">("VERIFIKASI");
  const [searchMyStore, setSearchMyStore] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isImageValid = (imageUrl?: string | null, imageExpiresAt?: Date | string | null) => {
    if (!imageUrl || !imageExpiresAt) return false;
    return new Date(imageExpiresAt).getTime() > Date.now();
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await verifyProductAction(formData);

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message });
      (e.target as HTMLFormElement).reset();
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const handleUpdateStore = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateStoreProductAction(formData);

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setEditingProduct(null);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  // Filter bahan di etalase toko sendiri berdasarkan kata kunci pencarian
  const filteredMyStore = myStoreProducts.filter((p) => {
    const q = searchMyStore.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.user?.name && p.user.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Dashboard Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏪</span>
            <h1 className="text-2xl font-bold text-gray-900">
              Toko {hubUser.name} <span className="text-sm font-normal text-gray-500">(Hub Pedagang)</span>
            </h1>
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Kelola verifikasi harian dari petani dan atur etalase bahan yang tokomu jual ke restoran.
          </p>
        </div>

        {/* Tab Navigasi Halaman */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab("VERIFIKASI")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === "VERIFIKASI"
                ? "bg-white text-amber-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>⏳ Antrean Masuk Petani</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === "VERIFIKASI"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {unverifiedProducts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ETALASE")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === "ETALASE"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>🛍️ Etalase Toko Saya</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === "ETALASE"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {myStoreProducts.length}
            </span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ===================== TAB 1: VERIFIKASI BAHAN DARI PETANI ===================== */}
      {activeTab === "VERIFIKASI" && (
        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>⏳ Verifikasi Bahan Masuk Per Hari</span>
              </h2>
              <p className="text-xs text-gray-500">
                Pilih bahan panen petani untuk dimasukkan dan dijual di tokomu hari ini.
              </p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200 font-semibold">
              {unverifiedProducts.length} Menunggu Diproses
            </span>
          </div>

          {unverifiedProducts.length === 0 ? (
            <div className="bg-gray-50 p-12 rounded-xl text-center border border-dashed border-gray-200">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="text-gray-500 text-sm font-medium">
                Semua bahan panen petani sudah selesai diverifikasi hari ini!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b text-xs">
                  <tr>
                    <th className="py-3 px-4">Foto Panen (24 Jam)</th>
                    <th className="py-3 px-4">Bahan Baku</th>
                    <th className="py-3 px-4">Asal Petani</th>
                    <th className="py-3 px-4">Stok Panen</th>
                    <th className="py-3 px-4">Harga Beli</th>
                    <th className="py-3 px-4">Pengaturan Toko & Jual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unverifiedProducts.map((item) => {
                    const valid = isImageValid(item.imageUrl, item.imageExpiresAt);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4">
                          {valid ? (
                            <div className="relative w-12 h-12">
                              <img
                                src={item.imageUrl!}
                                alt={item.name}
                                className="w-12 h-12 rounded-lg object-cover border border-emerald-500 shadow-sm"
                              />
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                              </span>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs text-center p-1 leading-tight">
                              {item.imageUrl ? "Expired" : "No Foto"}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">{item.name}</td>
                        <td className="py-3 px-4 text-emerald-700 font-medium">
                          🌱 {item.user?.name || "Petani"}
                        </td>
                        <td className="py-3 px-4">
                          {item.stock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          Rp {item.priceFarmer.toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4">
                          <form onSubmit={handleVerify} className="flex gap-2 items-center flex-wrap">
                            <input type="hidden" name="productId" value={item.id} />
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs text-gray-400">
                                Rp
                              </span>
                              <input
                                type="number"
                                name="priceHub"
                                placeholder="Harga Jual"
                                required
                                min={item.priceFarmer}
                                className="w-32 pl-8 pr-2.5 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              name="description"
                              placeholder="Deskripsi bahan (Opsional)"
                              className="w-52 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                              type="submit"
                              disabled={loading}
                              className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer shadow-sm disabled:opacity-50"
                            >
                              + Jual di Toko
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ===================== TAB 2: ETALASE TOKO PEDAGANG (MIRIP RESTORAN VIEW) ===================== */}
      {activeTab === "ETALASE" && (
        <section className="space-y-6">
          {/* Bar Pencarian Khusus Toko Sendiri */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Katalog Etalase Toko {hubUser.name}
              </h2>
              <p className="text-xs text-gray-500">
                Tampilan bahan yang saat ini dilihat dan dapat dibeli oleh Restoran dari tokomu.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                value={searchMyStore}
                onChange={(e) => setSearchMyStore(e.target.value)}
                placeholder="Cari bahan di tokomu..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Grid Produk Mirip Tampilan Halaman Restoran */}
          {filteredMyStore.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed text-center text-gray-500 space-y-2">
              <span className="text-3xl block">📦</span>
              <p className="font-semibold text-gray-800">
                {searchMyStore
                  ? `Tidak ada bahan di tokomu dengan nama "${searchMyStore}"`
                  : "Tokomu belum memverifikasi bahan panen apa pun untuk dijual."}
              </p>
              <p className="text-xs text-gray-400">
                Buka tab &quot;Antrean Masuk Petani&quot; untuk menambahkan bahan panen ke tokomu.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMyStore.map((item) => {
                const validImage = isImageValid(item.imageUrl, item.imageExpiresAt);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    {/* Foto Panen */}
                    <div className="h-44 w-full bg-gray-100 relative">
                      {validImage ? (
                        <>
                          <img
                            src={item.imageUrl!}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm shadow flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse"></span>
                            Live Update Panen (&lt;24 Jam)
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50">
                          <span className="text-2xl mb-1">📷</span>
                          <span>Foto panen telah kadaluarsa / terhapus</span>
                        </div>
                      )}
                    </div>

                    {/* Rincian Produk */}
                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded shrink-0">
                            Stok: {item.stock} {item.unit}
                          </span>
                        </div>

                        {/* Deskripsi Produk */}
                        {item.description ? (
                          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                            <span className="font-semibold text-gray-700">Deskripsi:</span>{" "}
                            {item.description}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">
                            Tanpa deskripsi produk
                          </div>
                        )}

                        <div className="pt-2 border-t text-xs space-y-1">
                          <div className="text-gray-500">
                            Asal Petani:{" "}
                            <strong className="text-emerald-700">
                              {item.user?.name || "Mitra Tani"}
                            </strong>
                          </div>
                          <div className="text-gray-500">
                            Harga Beli dari Petani:{" "}
                            <strong>Rp {item.priceFarmer.toLocaleString("id-ID")}</strong>
                          </div>
                        </div>

                        <p className="text-emerald-600 font-bold text-lg pt-1">
                          Rp {(item.priceHub || 0).toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-gray-500">/ {item.unit}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => setEditingProduct(item)}
                        className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-semibold transition cursor-pointer mt-2"
                      >
                        ✏️ Edit Harga & Stok Toko
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal Edit Produk Toko */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">
                Edit Bahan: {editingProduct.name}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStore} className="space-y-4 text-sm">
              <input type="hidden" name="productId" value={editingProduct.id} />

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Harga Jual Toko (Rp / {editingProduct.unit})
                </label>
                <input
                  type="number"
                  name="priceHub"
                  defaultValue={editingProduct.priceHub || editingProduct.priceFarmer}
                  min={editingProduct.priceFarmer}
                  required
                  className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Harga beli modal: Rp {editingProduct.priceFarmer.toLocaleString("id-ID")}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Jumlah Stok Tersedia ({editingProduct.unit})
                </label>
                <input
                  type="number"
                  name="stock"
                  defaultValue={editingProduct.stock}
                  min="0"
                  required
                  className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Keterangan Deskripsi (Opsional)
                </label>
                <textarea
                  name="description"
                  defaultValue={editingProduct.description || ""}
                  rows={3}
                  className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  placeholder="Keterangan kondisi bahan..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 rounded-lg border text-gray-700 font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
