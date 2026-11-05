"use client";

import { useState, useEffect } from "react";
import { verifyProductAction, updateStoreProductAction } from "./actions";
import { compressImage } from "@/lib/compressImage";

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
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const isImageValid = (imageUrl?: string | null, imageExpiresAt?: Date | string | null) => {
    if (!imageUrl || !imageExpiresAt) return false;
    return new Date(imageExpiresAt).getTime() > Date.now();
  };

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setCompressing(true);
        const compressed = await compressImage(file, 800, 800, 0.7);
        setEditImage(compressed);
        setEditPreview(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Gagal kompres gambar:", err);
        setEditImage(file);
        setEditPreview(URL.createObjectURL(file));
      } finally {
        setCompressing(false);
      }
    }
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
    if (editImage) {
      formData.set("image", editImage);
    }

    const res = await updateStoreProductAction(formData);

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setEditingProduct(null);
      setEditImage(null);
      setEditPreview(null);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

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
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      {/* Header Dashboard Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Toko {hubUser.name} <span className="text-sm font-normal text-gray-500">(Hub Pedagang)</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Verifikasi komoditas petani dan kelola etalase bahan untuk restoran mitra.
          </p>
        </div>

        {/* Tab Navigasi Halaman */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("VERIFIKASI")}
            className={`px-3 py-2 rounded-md text-xs font-medium transition cursor-pointer border ${
              activeTab === "VERIFIKASI"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Antrean Masuk ({unverifiedProducts.length})
          </button>

          <button
            onClick={() => setActiveTab("ETALASE")}
            className={`px-3 py-2 rounded-md text-xs font-medium transition cursor-pointer border ${
              activeTab === "ETALASE"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Etalase Toko ({myStoreProducts.length})
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-md text-xs font-medium border flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            message.type === "success"
              ? "bg-emerald-50/70 text-emerald-800 border-emerald-200"
              : "bg-rose-50/70 text-rose-800 border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-600 p-1 text-xs cursor-pointer"
            title="Tutup"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: VERIFIKASI BAHAN DARI PETANI */}
      {activeTab === "VERIFIKASI" && (
        <section className="bg-white p-4 rounded-md border border-gray-200 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Verifikasi Bahan Masuk
              </h2>
              <p className="text-xs text-gray-500">
                Pilih komoditas petani untuk dimasukkan dan dijual di tokomu hari ini.
              </p>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded font-medium">
              {unverifiedProducts.length} Menunggu Diproses
            </span>
          </div>

          {unverifiedProducts.length === 0 ? (
            <div className="bg-gray-50 p-8 rounded-md text-center border border-dashed border-gray-200">
              <p className="text-gray-500 text-sm font-medium">
                Semua bahan panen petani sudah selesai diverifikasi hari ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Foto</th>
                    <th className="py-2.5 px-3">Komoditas</th>
                    <th className="py-2.5 px-3">Asal Petani</th>
                    <th className="py-2.5 px-3">Stok Panen</th>
                    <th className="py-2.5 px-3">Harga Beli Petani</th>
                    <th className="py-2.5 px-3">Pengaturan Jual di Toko</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unverifiedProducts.map((item) => {
                    const valid = isImageValid(item.imageUrl, item.imageExpiresAt);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          {valid ? (
                            <img
                              src={item.imageUrl!}
                              alt={item.name}
                              className="w-12 h-12 rounded object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-[10px] text-center p-1">
                              {item.imageUrl ? "Expired" : "No Foto"}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-gray-700">
                          {item.user?.name || "Petani"}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.stock} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">
                          Rp {item.priceFarmer.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2.5 px-3">
                          <form onSubmit={handleVerify} className="flex gap-2 items-center flex-wrap">
                            <input type="hidden" name="productId" value={item.id} />
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-xs text-gray-400">
                                Rp
                              </span>
                              <input
                                type="number"
                                name="priceHub"
                                placeholder={`Min ${item.priceFarmer.toLocaleString("id-ID")}`}
                                required
                                min={item.priceFarmer}
                                title={`Harga jual minimal modal petani (Rp ${item.priceFarmer.toLocaleString("id-ID")})`}
                                className="w-28 pl-7 pr-2 py-1.5 border border-gray-300 rounded text-xs focus:border-emerald-500 outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              name="description"
                              placeholder="Deskripsi komoditas (opsional)"
                              className="w-48 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:border-emerald-500 outline-none"
                            />
                            <button
                              type="submit"
                              disabled={loading}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                            >
                              Jual di Toko
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

      {/* TAB 2: ETALASE TOKO PEDAGANG */}
      {activeTab === "ETALASE" && (
        <section className="space-y-4">
          <div className="bg-white p-4 rounded-md border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Katalog Etalase Toko {hubUser.name}
              </h2>
              <p className="text-xs text-gray-500">
                Komoditas yang aktif dijual dan dapat dipesan oleh restoran mitra.
              </p>
            </div>

            <div className="w-full md:w-72">
              <input
                type="text"
                value={searchMyStore}
                onChange={(e) => setSearchMyStore(e.target.value)}
                placeholder="Cari komoditas toko..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {filteredMyStore.length === 0 ? (
            <div className="bg-white p-8 rounded-md border border-dashed border-gray-200 text-center text-gray-500 space-y-1">
              <p className="font-medium text-gray-800 text-sm">
                {searchMyStore
                  ? `Tidak ada komoditas dengan nama "${searchMyStore}"`
                  : "Belum ada komoditas yang diverifikasi untuk dijual."}
              </p>
              <p className="text-xs text-gray-400">
                Periksa tab antrean masuk untuk menambahkan bahan panen ke etalase.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMyStore.map((item) => {
                const validImage = isImageValid(item.imageUrl, item.imageExpiresAt);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col justify-between"
                  >
                    <div className="h-40 w-full bg-gray-100 relative">
                      {validImage ? (
                        <>
                          <img
                            src={item.imageUrl!}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-gray-900/70 text-white text-[10px] font-medium px-2 py-0.5 rounded">
                            Update &lt;24 Jam
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50">
                          <span>Foto kadaluarsa</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-gray-900 text-sm">{item.name}</h3>
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded shrink-0">
                            Stok: {item.stock} {item.unit}
                          </span>
                        </div>

                        {item.description ? (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {item.description}
                          </p>
                        ) : null}

                        <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                          <div className="text-gray-500">
                            Petani:{" "}
                            <span className="text-gray-800 font-medium">
                              {item.user?.name || "Mitra Tani"}
                            </span>
                          </div>
                          <div className="text-gray-500">
                            Harga Beli:{" "}
                            <span>Rp {item.priceFarmer.toLocaleString("id-ID")}</span>
                          </div>
                        </div>

                        <p className="text-emerald-600 font-bold text-base pt-1">
                          Rp {(item.priceHub || 0).toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-gray-500">/ {item.unit}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setEditingProduct(item);
                          setEditImage(null);
                          setEditPreview(null);
                        }}
                        className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md text-xs font-medium transition cursor-pointer"
                      >
                        Edit Harga, Stok, dan Foto
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md p-5 max-w-md w-full border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">
                Edit: {editingProduct.name}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStore} className="space-y-3 text-xs">
              <input type="hidden" name="productId" value={editingProduct.id} />

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Harga Jual Toko (Rp / {editingProduct.unit})
                </label>
                <input
                  type="number"
                  name="priceHub"
                  defaultValue={editingProduct.priceHub || editingProduct.priceFarmer}
                  min={editingProduct.priceFarmer}
                  required
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Harga beli modal: Rp {editingProduct.priceFarmer.toLocaleString("id-ID")}
                </span>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Jumlah Stok Tersedia ({editingProduct.unit})
                </label>
                <input
                  type="number"
                  name="stock"
                  defaultValue={editingProduct.stock}
                  min="0"
                  required
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Keterangan Deskripsi (Opsional)
                </label>
                <textarea
                  name="description"
                  defaultValue={editingProduct.description || ""}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-xs"
                  placeholder="Keterangan kondisi komoditas..."
                />
              </div>

              {/* Upload Foto */}
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Perbarui Foto Komoditas
                </label>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={handleEditImageChange}
                  disabled={compressing}
                  className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer disabled:opacity-50"
                />
                {compressing && (
                  <p className="text-[10px] text-gray-500 mt-1">Mengompres foto...</p>
                )}
                {editPreview && !compressing && (
                  <div className="mt-2 relative rounded overflow-hidden border border-gray-200 w-full h-24">
                    <img
                      src={editPreview}
                      alt="Preview Baru"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || compressing}
                  className="flex-1 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : compressing ? "Mengompres..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
