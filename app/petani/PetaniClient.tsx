"use client";

import { useState, useEffect, useMemo } from "react";
import {
  addProductAction,
  updateProductFarmerAction,
  deleteProductFarmerAction,
  markHarvestFinishedAction,
} from "./actions";
import { addExpenseAction, deleteExpenseAction } from "@/app/actions/expense";
import { compressImage } from "@/lib/compressImage";
import ConfirmDialog from "@/components/ConfirmDialog";

export interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  notes: string | null;
  date: Date | string;
}

export interface IncomeEventItem {
  id: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  costPerUnit: number;
  revenue: number;
  costAuto: number;
  net: number;
  date: Date | string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  unit: string;
  priceFarmer: number;
  costFarmer?: number;
  isVerified: boolean;
  imageUrl?: string | null;
  imageExpiresAt?: Date | string | null;
  createdAt: Date | string;
  verifiedBy?: { id: string; name: string | null; username: string } | null;
  soldQuantity?: number;
  totalEarned?: number;
  totalCost?: number;
  averageRating?: number | null;
}

interface PetaniClientProps {
  products: Product[];
  stats: {
    totalProducts: number;
    verifiedCount: number;
    totalSoldUnits: number;
    totalRevenue: number;
    totalAutoCost: number;
    totalManualExpense: number;
    totalExpense: number;
    netProfit: number;
    profitMarginPercent: number;
  };
  expenses: ExpenseItem[];
  incomeEvents: IncomeEventItem[];
}

export default function PetaniClient({
  products,
  stats,
  expenses,
  incomeEvents,
}: PetaniClientProps) {
  const [activeTab, setActiveTab] = useState<"PANEN" | "KEUANGAN">("PANEN");
  const [timeFilter, setTimeFilter] = useState<"SEMUA" | "BULAN_INI" | "HARI_INI">("SEMUA");

  // Form Tambah Panen
  const [name, setName] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("kg");
  const [priceFarmer, setPriceFarmer] = useState("");
  const [costFarmer, setCostFarmer] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Edit Panen
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; hasOrders?: boolean } | null>(null);
  const [finishTarget, setFinishTarget] = useState<{ id: string; name: string } | null>(null);
  const [harvestFilter, setHarvestFilter] = useState<"SEMUA" | "AKTIF" | "HABIS">("SEMUA");

  // Catatan Pengeluaran (Opsi B)
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("BIBIT_PUPUK");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseNotes, setExpenseNotes] = useState("");
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseItem | null>(null);

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
        const compressed = await compressImage(file, 800, 800, 0.7);
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
        const compressed = await compressImage(file, 800, 800, 0.7);
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
    try {
      setLoading(true);
      setMessage(null);

      const formData = new FormData();
      formData.append("name", name);
      formData.append("stock", stock);
      formData.append("unit", unit);
      formData.append("priceFarmer", priceFarmer);
      if (costFarmer) {
        formData.append("costFarmer", costFarmer);
      }
      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      const res = await addProductAction(formData);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
        setName("");
        setStock("");
        setPriceFarmer("");
        setCostFarmer("");
        setSelectedImage(null);
        setPreviewUrl(null);
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal mendaftarkan panen:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan saat mendaftarkan panen. Silakan coba lagi." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setLoading(true);
      setMessage(null);

      const formData = new FormData(e.currentTarget);
      formData.append("productId", editingProduct.id);
      if (editImage) {
        formData.append("image", editImage);
      }

      const res = await updateProductFarmerAction(formData);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
        setEditingProduct(null);
        setEditImage(null);
        setEditPreview(null);
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal memperbarui panen:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan saat memperbarui panen. Silakan coba lagi." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      setLoading(true);
      setMessage(null);

      const res = await deleteProductFarmerAction(productId);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal menghapus panen:", err);
      setMessage({ type: "error", text: "Gagal memproses penghapusan panen. Silakan periksa koneksi Anda." });
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleFinish = async (productId: string) => {
    try {
      setLoading(true);
      setMessage(null);

      const res = await markHarvestFinishedAction(productId);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal menutup stok panen:", err);
      setMessage({ type: "error", text: "Terjadi gangguan saat menandai panen habis." });
    } finally {
      setLoading(false);
      setFinishTarget(null);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);

      const res = await addExpenseAction({
        title: expenseTitle,
        amount: Number(expenseAmount),
        category: expenseCategory,
        date: expenseDate,
        notes: expenseNotes,
      });

      if (res.success) {
        setMessage({ type: "success", text: res.message });
        setIsAddingExpense(false);
        setExpenseTitle("");
        setExpenseAmount("");
        setExpenseNotes("");
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal mencatat pengeluaran:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan saat mencatat pengeluaran." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      setLoading(true);
      setMessage(null);

      const res = await deleteExpenseAction(id);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal menghapus pengeluaran:", err);
      setMessage({ type: "error", text: "Gagal menghapus pengeluaran. Silakan coba lagi." });
    } finally {
      setLoading(false);
      setDeleteExpenseTarget(null);
    }
  };

  const isImageValid = (item: Product) => {
    return Boolean(item.imageUrl);
  };

  // Filter Hasil Panen (Semua / Stok Tersedia / Habis atau Arsip)
  const filteredProducts = useMemo(() => {
    if (harvestFilter === "AKTIF") {
      return products.filter((p) => p.stock > 0);
    }
    if (harvestFilter === "HABIS") {
      return products.filter((p) => p.stock === 0);
    }
    return products;
  }, [products, harvestFilter]);

  // Filter Keuangan Berdasarkan Periode Waktu
  const filteredData = useMemo(() => {
    const now = new Date();
    const isSameDay = (d: Date) =>
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const isSameMonth = (d: Date) =>
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

    const datePasses = (dateInput: Date | string) => {
      const d = new Date(dateInput);
      if (timeFilter === "HARI_INI") return isSameDay(d);
      if (timeFilter === "BULAN_INI") return isSameMonth(d);
      return true;
    };

    const filteredIncomes = incomeEvents.filter((it) => datePasses(it.date));
    const filteredManualExpenses = expenses.filter((ex) => datePasses(ex.date));

    const totalRev = filteredIncomes.reduce((sum, it) => sum + it.revenue, 0);
    const totalAuto = filteredIncomes.reduce((sum, it) => sum + it.costAuto, 0);
    const totalManual = filteredManualExpenses.reduce((sum, ex) => sum + ex.amount, 0);
    const totalExp = totalAuto + totalManual;
    const netProf = totalRev - totalExp;
    const marginPct = totalRev > 0 ? Math.round((netProf / totalRev) * 1000) / 10 : 0;

    return {
      incomes: filteredIncomes,
      manualExpenses: filteredManualExpenses,
      totalRevenue: totalRev,
      totalAutoCost: totalAuto,
      totalManualExpense: totalManual,
      totalExpense: totalExp,
      netProfit: netProf,
      profitMarginPercent: marginPct,
    };
  }, [incomeEvents, expenses, timeFilter]);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header & Navigasi Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Dashboard Penjualan & Keuangan Petani
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Kelola panen, pantau pesanan dari Toko Hub, dan periksa arus kas keuntungan bersih Anda.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("PANEN")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              activeTab === "PANEN"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
             Koleksi Panen ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("KEUANGAN")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              activeTab === "KEUANGAN"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
             Laporan Keuangan
          </button>
        </div>
      </div>

      {/* Pesan Notifikasi Feedback */}
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

      {/* ========================================================= */}
      {/* TAB 1: KOLEKSI PANEN                                       */}
      {/* ========================================================= */}
      {activeTab === "PANEN" && (
        <div className="space-y-6">
          {/* Metrik Ringkas Panen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Total Panen Terdaftar</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalProducts} Komoditas</p>
            </div>

            <div className="bg-white p-4 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Diverifikasi Toko Hub</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{stats.verifiedCount} Panen</p>
            </div>

            <div className="bg-white p-4 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Total Unit Terjual</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalSoldUnits} Unit</p>
            </div>

            <div className="bg-white p-4 rounded-md border border-gray-200 border-l-4 border-l-emerald-500">
              <span className="text-xs font-medium text-gray-500 block">Estimasi Omzet Penjualan</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                Rp {stats.totalRevenue.toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {/* Grid: Form Tambah Panen & Daftar Hasil Panen */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Form Tambah Panen */}
            <div className="bg-white p-4 rounded-md border border-gray-200 h-fit">
              <h2 className="text-lg font-medium text-gray-900 mb-1">Tambah Hasil Panen</h2>
              <p className="text-xs text-gray-500 mb-4">
                Daftarkan hasil panen kebun untuk diverifikasi dan dibeli oleh Toko Hub.
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Harga Jual (Rp / {unit})
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
                      Modal Tani (Rp) <span className="text-gray-400 font-normal">(Opsi A)</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="cth: 15000"
                      value={costFarmer}
                      onChange={(e) => setCostFarmer(e.target.value)}
                      title="Estimasi modal bibit & pupuk per satuan (opsional)"
                      className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Foto Hasil Panen (Bukti Kondisi Fisik)
                  </label>
                  <input
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                  />
                  {compressing && <p className="text-xs text-gray-500 mt-1">Mengompresi foto...</p>}
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Koleksi Panen Saya ({products.length})
                  </h2>
                  <span className="text-xs text-gray-500">Status verifikasi dan stok komoditas</span>
                </div>

                {/* Filter Tab Panen */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setHarvestFilter("SEMUA")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      harvestFilter === "SEMUA"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Semua ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHarvestFilter("AKTIF")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      harvestFilter === "AKTIF"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Tersedia ({products.filter((p) => p.stock > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHarvestFilter("HABIS")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      harvestFilter === "HABIS"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Habis/Arsip ({products.filter((p) => p.stock === 0).length})
                  </button>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white p-6 rounded-md border border-gray-200 text-center">
                  <p className="font-medium text-gray-700 text-sm">
                    {harvestFilter === "AKTIF"
                      ? "Tidak ada komoditas aktif dengan stok tersedia."
                      : harvestFilter === "HABIS"
                      ? "Belum ada komoditas panen yang habis atau diarsipkan."
                      : "Belum ada panen yang didaftarkan"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {harvestFilter === "SEMUA"
                      ? "Isi form di samping untuk mengunggah komoditas hasil tani Anda."
                      : "Ganti filter ke 'Semua' untuk melihat seluruh komoditas hasil panen Anda."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProducts.map((item) => {
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
                                <span>Tanpa Foto</span>
                              </div>
                            )}

                            {/* Badge Verifikasi Hub */}
                            <div className="absolute top-3 left-3">
                              {item.isVerified ? (
                                <span className="bg-emerald-600 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-xs">
                                  Diverifikasi Hub
                                </span>
                              ) : (
                                <span className="bg-gray-700/85 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-xs">
                                  Menunggu Verifikasi
                                </span>
                              )}
                            </div>

                            {/* Badge Status Stok */}
                            <div className="absolute top-3 right-3">
                              {item.stock > 0 ? (
                                <span className="bg-emerald-700/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-xs">
                                  Stok Tersedia
                                </span>
                              ) : (
                                <span className="bg-rose-700/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-xs">
                                  Panen Habis
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
                                Sisa Stok:{" "}
                                <strong
                                  className={
                                    item.stock > 0
                                      ? "text-emerald-700 font-semibold"
                                      : "text-rose-600 font-semibold"
                                  }
                                >
                                  {item.stock} {item.unit} {item.stock === 0 ? "(Habis)" : ""}
                                </strong>
                              </p>
                              {item.costFarmer ? (
                                <p className="text-gray-500">
                                  Modal Bibit:{" "}
                                  <span className="text-gray-700">
                                    Rp {item.costFarmer.toLocaleString("id-ID")}/{item.unit}
                                  </span>
                                </p>
                              ) : null}
                              <p>
                                Terjual:{" "}
                                <strong className="text-gray-800">
                                  {item.soldQuantity || 0} {item.unit}
                                </strong>{" "}
                                (Rp {(item.totalEarned || 0).toLocaleString("id-ID")})
                              </p>
                              {item.verifiedBy && (
                                <p className="text-xs text-gray-600 border border-gray-200 p-1.5 rounded">
                                  Diambil Toko Hub: <strong>{item.verifiedBy.name}</strong>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 pt-0 border-t border-gray-100 mt-2 flex items-center gap-2">
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
                          {item.stock > 0 && (
                            <button
                              onClick={() => setFinishTarget({ id: item.id, name: item.name })}
                              className="py-1.5 px-2.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition cursor-pointer"
                              title="Tandai panen selesai / stok habis"
                            >
                              Tandai Habis
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                id: item.id,
                                name: item.name,
                                hasOrders: Boolean(
                                  (item.soldQuantity && item.soldQuantity > 0) ||
                                  (item.totalEarned && item.totalEarned > 0)
                                ),
                              })
                            }
                            className="py-1.5 px-3 text-xs font-medium text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title={
                              Boolean((item.soldQuantity && item.soldQuantity > 0) || (item.totalEarned && item.totalEarned > 0))
                                ? "Arsipkan panen yang memiliki riwayat pesanan"
                                : "Hapus panen secara permanen"
                            }
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
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LAPORAN KEUANGAN                                    */}
      {/* ========================================================= */}
      {activeTab === "KEUANGAN" && (
        <div className="space-y-6">
          {/* Header Bar: Filter Waktu & Tombol Catat Pengeluaran */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 mr-1">Periode:</span>
              {(["SEMUA", "BULAN_INI", "HARI_INI"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                    timeFilter === filter
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {filter === "SEMUA" ? "Semua Waktu" : filter === "BULAN_INI" ? "Bulan Ini" : "Hari Ini"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddingExpense(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md shadow-xs transition cursor-pointer"
            >
              <span>+</span> Catat Pengeluaran Baru (Opsi B)
            </button>
          </div>

          {/* 3 Kartu Ringkasan Keuangan Sederhana */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Total Pendapatan */}
            <div className="bg-white p-5 rounded-lg border border-emerald-200 shadow-xs relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  1. Total Pendapatan
                </span>
                <span className="text-emerald-600 text-base">🟢</span>
              </div>
              <p className="text-2xl font-black text-gray-900 mt-2">
                Rp {filteredData.totalRevenue.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Dari {filteredData.incomes.length} transaksi penjualan hasil panen
              </p>
            </div>

            {/* 2. Total Pengeluaran */}
            <div className="bg-white p-5 rounded-lg border border-rose-200 shadow-xs relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                  2. Total Pengeluaran
                </span>
                <span className="text-rose-600 text-base">🔴</span>
              </div>
              <p className="text-2xl font-black text-rose-600 mt-2">
                Rp {filteredData.totalExpense.toLocaleString("id-ID")}
              </p>
              <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                <span>
                  Modal Panen (Opsi A): Rp {filteredData.totalAutoCost.toLocaleString("id-ID")}
                </span>
                <span>
                  Catatan Biaya (Opsi B): Rp {filteredData.totalManualExpense.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* 3. Keuntungan Bersih */}
            <div className="bg-white p-5 rounded-lg border-2 border-emerald-500 shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  3. Untung Bersih (Laba)
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Margin {filteredData.profitMarginPercent}%
                </span>
              </div>
              <p
                className={`text-2xl font-black mt-2 ${
                  filteredData.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                Rp {filteredData.netProfit.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-gray-600 mt-1">Uang bersih yang diterima petani</p>
            </div>
          </div>

          {/* Rincian Arus Kas: Tabel Pemasukan & Tabel Pengeluaran */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabel Pemasukan dari Panen Terjual */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">↑</span> Riwayat Penjualan Panen
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {filteredData.incomes.length} item
                </span>
              </div>

              {filteredData.incomes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Belum ada transaksi penjualan pada periode ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredData.incomes.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-2.5 rounded-md border border-gray-100 bg-gray-50/60 flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900">
                          {inc.productName}{" "}
                          <span className="text-gray-500 font-normal">
                            ({inc.quantity} {inc.unit})
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {new Date(inc.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          • No: {inc.orderNumber}
                        </div>
                        {inc.costAuto > 0 && (
                          <div className="text-[11px] text-gray-400">
                            Modal: Rp {inc.costAuto.toLocaleString("id-ID")} (Rp{" "}
                            {inc.costPerUnit.toLocaleString("id-ID")}/{inc.unit})
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-emerald-600">
                          + Rp {inc.revenue.toLocaleString("id-ID")}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Untung: Rp {inc.net.toLocaleString("id-ID")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabel Catatan Pengeluaran Biaya (Opsi B) */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="text-rose-600 font-bold">↓</span> Catatan Pengeluaran Tani (Opsi B)
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {filteredData.manualExpenses.length} catatan
                </span>
              </div>

              {filteredData.manualExpenses.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Belum ada catatan pengeluaran mandiri. Klik{" "}
                  <button
                    onClick={() => setIsAddingExpense(true)}
                    className="text-emerald-600 font-medium underline"
                  >
                    + Catat Pengeluaran
                  </button>{" "}
                  untuk menambah bon pupuk/bibit.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredData.manualExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-2.5 rounded-md border border-gray-100 bg-gray-50/60 flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span>{exp.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-normal bg-gray-200 text-gray-700">
                            {exp.category === "BIBIT_PUPUK"
                              ? "Bibit & Pupuk"
                              : exp.category === "OPERASIONAL"
                              ? "Operasional/Upah"
                              : exp.category === "LOGISTIK"
                              ? "Logistik"
                              : "Lainnya"}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {new Date(exp.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {exp.notes ? ` • ${exp.notes}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="font-bold text-rose-600 text-right">
                          - Rp {exp.amount.toLocaleString("id-ID")}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeleteExpenseTarget(exp)}
                          className="text-gray-400 hover:text-rose-600 p-1 text-xs cursor-pointer"
                          title="Hapus pengeluaran ini"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Catatan Pengeluaran (Opsi B) */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Catat Pengeluaran Baru</h3>
              <button
                type="button"
                onClick={() => setIsAddingExpense(false)}
                className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Keterangan Pengeluaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Beli Pupuk NPK 50kg / Bibit Cabai"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Jumlah Biaya (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    placeholder="cth: 250000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="BIBIT_PUPUK">Bibit & Pupuk</option>
                    <option value="OPERASIONAL">Upah & Operasional</option>
                    <option value="LOGISTIK">Logistik / Bensin</option>
                    <option value="LAINNYA">Lain-lain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Biaya</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Catatan Tambahan <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="cth: Bon toko pertanian Berkah Makmur"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Hapus Pengeluaran */}
      <ConfirmDialog
        isOpen={!!deleteExpenseTarget}
        title="Hapus Catatan Pengeluaran?"
        description={`Catatan pengeluaran "${deleteExpenseTarget?.title}" sebesar Rp ${deleteExpenseTarget?.amount.toLocaleString(
          "id-ID"
        )} akan dihapus dari buku kas.`}
        confirmText="Hapus Pengeluaran"
        cancelText="Batal"
        isDanger
        isLoading={loading}
        onConfirm={() => {
          if (deleteExpenseTarget) handleDeleteExpense(deleteExpenseTarget.id);
        }}
        onCancel={() => {
          if (!loading) setDeleteExpenseTarget(null);
        }}
      />

      {/* Dialog Konfirmasi Hapus / Arsip Panen */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.hasOrders ? "Arsipkan Hasil Panen?" : "Hapus Hasil Panen?"}
        description={
          deleteTarget?.hasOrders
            ? `Komoditas "${deleteTarget?.name}" sudah memiliki riwayat transaksi penjualan. Demi menjaga integritas pembukuan dan omzet, data panen ini akan diarsipkan (stok dikosongkan) dan tidak dihapus permanen.`
            : `Komoditas "${deleteTarget?.name}" belum memiliki transaksi dan akan dihapus secara permanen dari daftar panen Anda.`
        }
        confirmText={deleteTarget?.hasOrders ? "Arsipkan Panen" : "Hapus Permanen"}
        cancelText="Batal"
        isDanger={!deleteTarget?.hasOrders}
        isLoading={loading}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
        }}
        onCancel={() => {
          if (!loading) setDeleteTarget(null);
        }}
      />

      {/* Dialog Konfirmasi Tandai Panen Selesai / Habis */}
      <ConfirmDialog
        isOpen={!!finishTarget}
        title="Tandai Panen Selesai?"
        description={`Stok komoditas "${finishTarget?.name}" akan diset menjadi 0 dan ditandai habis. Produk ini tidak lagi ditawarkan ke Hub, tetapi riwayat penjualan Anda tetap tercatat.`}
        confirmText="Tutup Stok Panen"
        cancelText="Batal"
        isLoading={loading}
        onConfirm={() => {
          if (finishTarget) handleFinish(finishTarget.id);
        }}
        onCancel={() => {
          if (!loading) setFinishTarget(null);
        }}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Harga Jual Petani (Rp)
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
                    Modal Tani (Rp) <span className="text-gray-400 font-normal">(Opsi A)</span>
                  </label>
                  <input
                    type="number"
                    name="costFarmer"
                    min="0"
                    defaultValue={editingProduct.costFarmer || 0}
                    className="w-full border border-gray-300 rounded-md p-2 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Perbarui Foto Panen (Opsional)
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
