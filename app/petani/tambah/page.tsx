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
    <div className="p-4 max-w-2xl mx-auto space-y-4 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tambah Panen Baru</h1>
          <p className="text-xs text-gray-500 mt-0.5">Daftarkan komoditas panen untuk diajukan ke Toko Hub.</p>
        </div>
        <Link href="/petani" className="text-xs text-gray-500 hover:text-gray-800 font-medium px-3 py-1.5 border border-gray-200 rounded-md">
          Kembali
        </Link>
      </div>

      <div className="bg-white p-4 rounded-md border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nama Produk
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Contoh: Wortel Organik"
              className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500 text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Jumlah Stok
              </label>
              <input
                type="number"
                name="stock"
                required
                min="1"
                placeholder="Contoh: 100"
                className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Satuan
              </label>
              <select
                name="unit"
                className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500 text-gray-900 bg-white"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="ikat">Ikat</option>
                <option value="karung">Karung</option>
                <option value="ton">Ton</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Harga Jual Petani (Rp)
            </label>
            <input
              type="number"
              name="priceFarmer"
              required
              min="100"
              placeholder="Contoh: 15000"
              className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Foto Panen
            </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
              disabled={compressing}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer disabled:opacity-50"
            />
            {compressing && (
              <p className="text-[10px] text-gray-500 mt-1">Mengompres foto...</p>
            )}
            {previewUrl && !compressing && (
              <div className="mt-2 relative rounded overflow-hidden border border-gray-200 w-full h-36">
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
                  className="absolute top-1 right-1 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || compressing}
            className="w-full bg-emerald-600 text-white font-medium py-2 rounded-md mt-2 hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer text-xs"
          >
            {loading ? "Menyimpan..." : compressing ? "Mengompres..." : "Simpan dan Ajukan ke Hub"}
          </button>
        </form>
      </div>
    </div>
  );
}
