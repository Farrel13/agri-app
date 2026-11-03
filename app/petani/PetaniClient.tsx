"use client";

import { useState, useEffect } from "react";
import {
  addProductAction,
  updateProductFarmerAction,
  deleteProductFarmerAction,
} from "./actions";
import { compressImage } from "@/lib/compressImage";
import ConfirmDialog from "@/components/ConfirmDialog";

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
  verifiedBy?: { id: string; name: string | null; username: string } | null;
  soldQuantity?: number;
  totalEarned?: number;
  averageRating?: number | null;
}

interface PetaniClientProps {
  products: Product[];
  stats: {
    totalProducts: number;
    verifiedCount: number;
    totalSoldUnits: number;
    totalRevenue: number;
  };
}

export default function PetaniClient({ products, stats }: PetaniClientProps) {
  // Form Tambah
  const [name, setName] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("kg");
  const [priceFarmer, setPriceFarmer] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Edit
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setCompressing(true);
        const compressed = await compressImage(file, 1200, 1200, 0.75);
        setEditImage(compressed);
        setEditPreview(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Gagal kompres:", err);
        setEditImage(file);
        setEditPreview(URL.createObjectURL(file));
      } finally {
        setCompressing(false);
      }
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

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append("productId", editingProduct.id);
    if (editImage) {
      formData.append("image", editImage);
    }

    const res = await updateProductFarmerAction(formData);
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

  const handleDelete = async (productId: string) => {
    setLoading(true);
    setMessage(null);

    const res = await deleteProductFarmerAction(productId);
    setLoading(false);
    setDeleteTarget(null);

    if (res.success) {
      setMessage({ type: "success", text: res.message });
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const isImageValid = (item: Product) => {
    if (!item.imageUrl || !item.imageExpiresAt) return false;
    return new Date(item.imageExpiresAt).getTime() > Date.now();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Dashboard Penjualan Petani
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola panen, pantau verifikasi, dan penghasilan.
          </p>
        </div>
      </div>

      {/* Pesan Feedback */}
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

      {/* Metrik Finansial & Penjualan Petani */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Total Panen Diunggah
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalProducts} Komoditas</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Terverifikasi Toko Hub
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.verifiedCount} Panen</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Total Unit Terjual
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalSoldUnits} Unit</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200 border-l-4 border-l-emerald-500">
          <span className="text-xs font-medium text-gray-500 block">
            Estimasi Saldo / Omzet
          </span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            Rp {stats.totalRevenue.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Grid: Form Tambah Panen & Daftar Hasil Panen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Tambah Panen */}
        <div className="bg-white p-4 rounded-md border border-gray-200 h-fit">
          <h2 className="text-lg font-medium text-gray-900 mb-1">
            Tambah Hasil Panen
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Daftarkan hasil kebun untuk diverifikasi dan dibeli oleh Toko Hub.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nama Komoditas</label>
              <input
                type="text"
                required
                placeholder="cth: Cabai Rawit Merah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Stok Panen</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="100"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Satuan</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 bg-white text-sm"
                >
                  <option value="kg">kg (Kilogram)</option>
                  <option value="ton">ton</option>
                  <option value="ikat">ikat</option>
                  <option value="karung">karung</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Harga Modal Petani (Rp / {unit})
              </label>
              <input
                type="number"
                required
                min="100"
                placeholder="25000"
                value={priceFarmer}
                onChange={(e) => setPriceFarmer(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Foto Bukti Segar (Berlaku 24 Jam)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
              />
              {compressing && (
                <p className="text-xs text-gray-500 mt-1">Mengompresi foto...</p>
              )}
              {previewUrl && (
                <div className="mt-3 relative w-full h-32 rounded-md overflow-hidden border border-gray-200">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || compressing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md transition disabled:opacity-50 text-sm cursor-pointer"
            >
              {loading ? "Menyimpan Panen..." : "Daftarkan Panen"}
            </button>
          </form>
        </div>

        {/* Daftar Panen Milik Petani */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Koleksi Panen Saya ({products.length})
            </h2>
            <span className="text-xs text-gray-500">
              Status verifikasi dan pesanan
            </span>
          </div>

          {products.length === 0 ? (
            <div className="bg-white p-6 rounded-md border border-gray-200 text-center">
              <p className="font-medium text-gray-700 text-sm">Belum ada panen yang didaftarkan</p>
              <p className="text-xs text-gray-400 mt-1">
                Isi form di samping untuk mengunggah komoditas hasil tani Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map((item) => {
                const imgValid = isImageValid(item);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Foto */}
                      <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                        {imgValid && item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                            <span>{item.imageUrl ? "Foto Expired (>24 Jam)" : "Tanpa Foto"}</span>
                          </div>
                        )}

                        {/* Badge Verifikasi */}
                        <div className="absolute top-3 left-3">
                          {item.isVerified ? (
                            <span className="bg-emerald-600 text-white text-[10px] font-medium px-2 py-1 rounded">
                              Diverifikasi Hub
                            </span>
                          ) : (
                            <span className="bg-gray-500 text-white text-[10px] font-medium px-2 py-1 rounded">
                              Menunggu Verifikasi
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Panen */}
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-gray-900 text-sm">{item.name}</h3>
                          <span className="text-xs font-medium text-emerald-600 bg-white border border-gray-200 px-2 py-1 rounded">
                            Rp {item.priceFarmer.toLocaleString("id-ID")}/{item.unit}
                          </span>
                        </div>

                        <div className="text-xs text-gray-600 space-y-1">
                          <p>
                            Sisa Stok: <strong className="text-gray-800">{item.stock} {item.unit}</strong>
                          </p>
                          <p>
                            Terjual:{" "}
                            <strong className="text-gray-800">
                              {item.soldQuantity || 0} {item.unit}
                            </strong>
                            {" "}(Rp {(item.totalEarned || 0).toLocaleString("id-ID")})
                          </p>
                          {item.verifiedBy && (
                            <p className="text-xs text-gray-600 border border-gray-200 p-1.5 rounded">
                              Diambil Toko Hub: <strong>{item.verifiedBy.name}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Edit & Hapus */}
                    <div className="p-4 pt-0 border-t border-gray-100 mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProduct(item);
                          setEditImage(null);
                          setEditPreview(null);
                        }}
                        className="flex-1 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition cursor-pointer"
                      >
                        Edit Panen
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                        className="py-1.5 px-3 text-xs font-medium text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Hapus Hasil Panen?"
        description={`Komoditas "${deleteTarget?.name}" akan dihapus dari daftar panen Anda secara permanen.`}
        confirmText="Hapus Panen"
        cancelText="Batal"
        isDanger
        isLoading={loading}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal Edit Panen */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-lg p-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Edit Data Panen</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Komoditas</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingProduct.name}
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stok Panen</label>
                  <input
                    type="number"
                    name="stock"
                    required
                    min="0"
                    defaultValue={editingProduct.stock}
                    className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Satuan</label>
                  <select
                    name="unit"
                    defaultValue={editingProduct.unit}
                    className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 bg-white text-sm"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="ton">ton</option>
                    <option value="ikat">ikat</option>
                    <option value="karung">karung</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Harga Modal Petani (Rp)
                </label>
                <input
                  type="number"
                  name="priceFarmer"
                  required
                  min="100"
                  defaultValue={editingProduct.priceFarmer}
                  className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Perbarui Foto (Opsional, reset jam expired ke 24 jam)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleEditImageChange}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 cursor-pointer"
                />
                {editPreview && (
                  <div className="mt-2 h-28 w-full rounded-md overflow-hidden border border-gray-200">
                    <img src={editPreview} alt="Preview baru" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || compressing}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
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
