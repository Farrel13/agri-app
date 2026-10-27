"use client";

import { useState } from "react";
import { addProductAction } from "./actions";

interface Product {
  id: string;
  name: string;
  stock: number;
  unit: string;
  priceFarmer: number;
  isVerified: boolean;
  imageUrl?: string | null;
  imageExpiresAt?: Date | string | null;
  createdAt: Date | string;
}

export default function PetaniClient({ products }: { products: Product[] }) {
  const [name, setName] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("kg");
  const [priceFarmer, setPriceFarmer] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("stock", stock);
    formData.append("unit", unit);
    formData.append("priceFarmer", priceFarmer);
    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    const res = await addProductAction(formData);

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setName("");
      setStock("");
      setPriceFarmer("");
      setSelectedImage(null);
      setPreviewUrl(null);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  // Cek apakah gambar masih aktif (< 24 jam)
  const isImageValid = (item: Product) => {
    if (!item.imageUrl || !item.imageExpiresAt) return false;
    return new Date(item.imageExpiresAt).getTime() > Date.now();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Petani</h1>
        <p className="text-gray-600">Kelola dan daftarkan hasil panen Anda ke sistem Hub.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Tambah Hasil Panen */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3 mb-4">
            🌱 Tambah Hasil Panen
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Nama Bahan / Hasil Panen
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Cabai Merah Keriting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Jumlah Stok
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="100"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Satuan
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="kg">kg</option>
                  <option value="ton">ton</option>
                  <option value="ikat">ikat</option>
                  <option value="karung">karung</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Harga Petani (per {unit})
              </label>
              <input
                type="number"
                min="100"
                required
                placeholder="25000"
                value={priceFarmer}
                onChange={(e) => setPriceFarmer(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Input Foto Hasil Panen (Status 24 Jam) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center justify-between">
                <span>Foto Panen Terkini</span>
                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Aktif 24 Jam ⏱️
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              {previewUrl && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-emerald-300 w-full h-36">
                  <img
                    src={previewUrl}
                    alt="Preview Panen"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full hover:bg-black/80"
                  >
                    ✕ Batal
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? "Menyimpan..." : "Kirim ke Hub"}
            </button>
          </form>
        </div>

        {/* Daftar Hasil Panen Terdaftar */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Daftar Produk Terdaftar</h2>

          {products.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-dashed text-center text-gray-500">
              Belum ada hasil panen yang ditambahkan.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b text-gray-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4">Foto (24 Jam)</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4">Stok</th>
                    <th className="py-3 px-4">Harga Petani</th>
                    <th className="py-3 px-4">Status Hub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((item) => {
                    const validImage = isImageValid(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4">
                          {validImage ? (
                            <div className="relative group w-12 h-12">
                              <img
                                src={item.imageUrl!}
                                alt={item.name}
                                className="w-12 h-12 rounded-lg object-cover border-2 border-emerald-500 shadow-sm"
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
                        <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                        <td className="py-3 px-4 text-gray-700">
                          {item.stock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-emerald-600 font-semibold">
                          Rp {item.priceFarmer.toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4">
                          {item.isVerified ? (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">
                              ✓ Terverifikasi
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">
                              ⏳ Menunggu Hub
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
