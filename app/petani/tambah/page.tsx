"use client";

import Link from "next/link";
import { addProductAction } from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { compressImage } from "@/lib/compressImage";

export default function HalamanTambahPanen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setCompressing(true);
        const compressed = await compressImage(file, 1200, 1200, 0.75);
        setSelectedImage(compressed);
        setPreviewUrl(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Gagal kompres gambar:", err);
        setSelectedImage(file);
        setPreviewUrl(URL.createObjectURL(file));
      } finally {
        setCompressing(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (selectedImage) {
      formData.set("image", selectedImage);
    }

    const res = await addProductAction(formData);
    setLoading(false);

    if (res.success) {
      alert(res.message);
      router.push("/petani");
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Tambah Panen Baru</h1>
        <Link href="/petani" className="text-gray-500 hover:text-gray-700">
          Kembali
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Produk
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Contoh: Wortel Organik"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah Stok
              </label>
              <input
                type="number"
                name="stock"
                required
                min="1"
                placeholder="Contoh: 100"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Satuan
              </label>
              <select
                name="unit"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="ikat">Ikat</option>
                <option value="karung">Karung</option>
                <option value="ton">Ton</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Harga Jual Petani (Rp)
            </label>
            <input
              type="number"
              name="priceFarmer"
              required
              min="100"
              placeholder="Contoh: 15000"
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
            />
          </div>

          {/* Upload Foto dengan Kompresi Otomatis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
              <span>Foto Panen (24 Jam)</span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Auto-Kompres ⚡
              </span>
            </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
              disabled={compressing}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer disabled:opacity-50"
            />
            {compressing && (
              <p className="text-xs text-blue-600 mt-1">Mengompres foto...</p>
            )}
            {previewUrl && !compressing && (
              <div className="mt-2 relative rounded overflow-hidden border w-full h-40">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded hover:bg-black/80"
                >
                  ✕ Batal
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || compressing}
            className="w-full bg-green-600 text-white font-bold py-3 rounded mt-4 hover:bg-green-700 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Menyimpan..." : compressing ? "Mengompres..." : "Simpan & Ajukan ke Hub"}
          </button>
        </form>
      </div>
    </div>
  );
}
