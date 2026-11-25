"use client";

import { useState, useEffect, useMemo } from "react";
import { verifyProductAction, updateStoreProductAction, removeStoreProductAction } from "./actions";
import { addExpenseAction, deleteExpenseAction } from "@/app/actions/expense";
import { compressImage } from "@/lib/compressImage";
import ConfirmDialog from "@/components/ConfirmDialog";

export interface HubSalesItem {
  id: string;
  orderNumber: string;
  buyerName: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  farmerCostPerUnit: number;
  revenue: number;
  farmerCost: number;
  netMargin: number;
  date: Date | string;
  status: string;
}

export interface HubExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  notes: string | null;
  date: Date | string;
}

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
  financialStats: {
    totalOrders: number;
    completedOrdersCount: number;
    totalRevenue: number;
    totalFarmerCost: number;
    totalManualExpense: number;
    totalExpense: number;
    netProfit: number;
    profitMarginPercent: number;
  };
  salesEvents: HubSalesItem[];
  expenses: HubExpenseItem[];
  hubUser: { id: string; name: string };
}

export default function HubClient({
  unverifiedProducts,
  myStoreProducts,
  salesEvents,
  expenses,
  hubUser,
}: HubClientProps) {
  const [activeTab, setActiveTab] = useState<"VERIFIKASI" | "ETALASE" | "KEUANGAN">("VERIFIKASI");
  const [timeFilter, setTimeFilter] = useState<"SEMUA" | "BULAN_INI" | "HARI_INI">("SEMUA");
  const [searchMyStore, setSearchMyStore] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Biaya Operasional Mandiri Hub (Opsi B)
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("OPERASIONAL");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseNotes, setExpenseNotes] = useState("");
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<HubExpenseItem | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const isImageValid = (imageUrl?: string | null) => {
    return Boolean(imageUrl);
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
    try {
      setLoading(true);
      setMessage(null);

      const formData = new FormData(e.currentTarget);
      const res = await verifyProductAction(formData);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
        (e.target as HTMLFormElement).reset();
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal memproses pembelian panen:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan saat memproses pembelian panen. Silakan coba lagi." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStore = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);

      const formData = new FormData(e.currentTarget);
      if (editImage) {
        formData.set("image", editImage);
      }

      const res = await updateStoreProductAction(formData);

      if (res.success) {
        setMessage({ type: "success", text: res.message });
        setEditingProduct(null);
        setEditImage(null);
        setEditPreview(null);
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal memperbarui etalase:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan saat memperbarui etalase toko." });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStore = async (productId: string) => {
    if (!confirm("Turunkan komoditas ini dari etalase tokomu? (Data panen asli petani tetap aman & utuh)")) return;
    try {
      setLoading(true);
      setMessage(null);

      const res = await removeStoreProductAction(productId);
      if (res.success) {
        setMessage({ type: "success", text: res.message });
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err) {
      console.error("Gagal menurunkan produk:", err);
      setMessage({ type: "error", text: "Terjadi gangguan saat menurunkan produk dari etalase." });
    } finally {
      setLoading(false);
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
      setMessage({ type: "error", text: "Terjadi gangguan saat mencatat biaya operasional toko." });
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
      setMessage({ type: "error", text: "Gagal menghapus pengeluaran toko." });
    } finally {
      setLoading(false);
      setDeleteExpenseTarget(null);
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

  // Filter Keuangan Hub
  const filteredFinancialData = useMemo(() => {
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

    const filteredSales = salesEvents.filter((s) => datePasses(s.date));
    const filteredExpenses = expenses.filter((ex) => datePasses(ex.date));

    const totalRev = filteredSales.reduce((sum, s) => sum + s.revenue, 0);
    const totalFarmer = filteredSales.reduce((sum, s) => sum + s.farmerCost, 0);
    const totalManual = filteredExpenses.reduce((sum, ex) => sum + ex.amount, 0);
    const totalExp = totalFarmer + totalManual;
    const netProf = totalRev - totalExp;
    const marginPct = totalRev > 0 ? Math.round((netProf / totalRev) * 1000) / 10 : 0;

    return {
      sales: filteredSales,
      manualExpenses: filteredExpenses,
      totalRevenue: totalRev,
      totalFarmerCost: totalFarmer,
      totalManualExpense: totalManual,
      totalExpense: totalExp,
      netProfit: netProf,
      profitMarginPercent: marginPct,
    };
  }, [salesEvents, expenses, timeFilter]);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      {/* Header Dashboard Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Toko {hubUser.name} <span className="text-sm font-normal text-gray-500">(Hub Pedagang)</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Verifikasi komoditas petani, kelola etalase bahan untuk restoran, dan pantau margin laba bersih toko.
          </p>
        </div>

        {/* Tab Navigasi Halaman */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setActiveTab("VERIFIKASI")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "VERIFIKASI"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Antrean Masuk ({unverifiedProducts.length})
          </button>

          <button
            onClick={() => setActiveTab("ETALASE")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "ETALASE"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Etalase Toko ({myStoreProducts.length})
          </button>

          <button
            onClick={() => setActiveTab("KEUANGAN")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "KEUANGAN"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
             Laporan Keuangan
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

      {/* ========================================================= */}
      {/* TAB 1: ANTREAN VERIFIKASI PANEN MASUK                     */}
      {/* ========================================================= */}
      {activeTab === "VERIFIKASI" && (
        <section className="bg-white p-4 rounded-md border border-gray-200 space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Antrean Panen Masuk ({unverifiedProducts.length})
              </h2>
              <p className="text-xs text-gray-500">
                Komoditas yang baru saja didaftarkan petani mitra dan siap Anda verifikasi untuk dijual ke restoran.
              </p>
            </div>
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
                    <th className="py-2.5 px-3">Sisa Stok Panen</th>
                    <th className="py-2.5 px-3">Harga Modal Petani</th>
                    <th className="py-2.5 px-3">Beli & Pengaturan Toko Hub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unverifiedProducts.map((item) => {
                    const valid = isImageValid(item.imageUrl);
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
                              Tanpa Foto
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-gray-700">{item.user?.name || "Petani"}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-emerald-700">
                            {item.stock} {item.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium">
                          Rp {item.priceFarmer.toLocaleString("id-ID")}/{item.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          <form onSubmit={handleVerify} className="flex gap-2 items-end flex-wrap">
                            <input type="hidden" name="productId" value={item.id} />

                            {/* Kuantitas yang dibeli pedagang */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-medium text-gray-500">
                                Beli ({item.unit})
                              </span>
                              <div className="relative">
                                <input
                                  type="number"
                                  name="quantity"
                                  required
                                  min="1"
                                  max={item.stock}
                                  defaultValue={item.stock}
                                  title={`Tentukan jumlah yang ingin Anda beli (1 - ${item.stock} ${item.unit})`}
                                  className="w-24 pl-2 pr-7 py-1.5 border border-gray-300 rounded text-xs focus:border-emerald-500 outline-none font-semibold text-gray-900"
                                />
                                <span className="absolute inset-y-0 right-0 pr-1.5 flex items-center text-[10px] text-gray-400 pointer-events-none">
                                  {item.unit}
                                </span>
                              </div>
                            </div>

                            {/* Harga Jual Toko */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-medium text-gray-500">
                                Harga Jual Toko
                              </span>
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
                            </div>

                            {/* Deskripsi Mutu Toko */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-medium text-gray-500">
                                Deskripsi Mutu (Opsional)
                              </span>
                              <input
                                type="text"
                                name="description"
                                placeholder="cth: Kualitas Super..."
                                className="w-36 px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-emerald-500 outline-none"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={loading}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-1.5 rounded transition cursor-pointer text-xs disabled:opacity-50 shrink-0 mb-0.5"
                              title="Beli jumlah ini dan pasang di etalase tokomu"
                            >
                              {loading ? "Memproses..." : "Beli & Pasang"}
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

      {/* ========================================================= */}
      {/* TAB 2: ETALASE TOKO HUB                                   */}
      {/* ========================================================= */}
      {activeTab === "ETALASE" && (
        <section className="bg-white p-4 rounded-md border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Etalase Bahan Toko ({filteredMyStore.length})
              </h2>
              <p className="text-xs text-gray-500">
                Bahan segar yang sedang aktif dijual di etalase toko Anda untuk dipesan restoran mitra.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari bahan etalase..."
                value={searchMyStore}
                onChange={(e) => setSearchMyStore(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-md px-3 py-1.5 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {filteredMyStore.length === 0 ? (
            <div className="bg-gray-50 p-8 rounded-md text-center border border-dashed border-gray-200">
              <p className="text-gray-500 text-sm font-medium">
                Belum ada komoditas di etalase tokomu.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Buka tab &quot;Antrean Masuk&quot; untuk memverifikasi bahan panen petani.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMyStore.map((item) => {
                const valid = isImageValid(item.imageUrl);
                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg overflow-hidden flex flex-col justify-between bg-white hover:shadow-sm transition"
                  >
                    <div className="relative h-40 w-full bg-gray-100">
                      {valid ? (
                        <>
                          <img
                            src={item.imageUrl!}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-emerald-800/80 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-xs">
                            Etalase Harian Aktif
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50">
                          <span>Tanpa Foto</span>
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
                          <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                        ) : null}

                        <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                          <div className="text-gray-500">
                            Petani:{" "}
                            <span className="text-gray-800 font-medium">
                              {item.user?.name || "Mitra Tani"}
                            </span>
                          </div>
                          <div className="text-gray-500">
                            Harga Beli: <span>Rp {item.priceFarmer.toLocaleString("id-ID")}</span>
                          </div>
                        </div>

                        <p className="text-emerald-600 font-bold text-base pt-1">
                          Rp {(item.priceHub || 0).toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-gray-500">/ {item.unit}</span>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingProduct(item);
                            setEditImage(null);
                            setEditPreview(null);
                          }}
                          className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md text-xs font-medium transition cursor-pointer"
                        >
                          Edit Etalase
                        </button>
                        <button
                          onClick={() => handleRemoveStore(item.id)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-medium transition cursor-pointer"
                          title="Turunkan dari etalase tokomu (data panen petani tetap aman)"
                        >
                          Turunkan
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LAPORAN KEUANGAN & LABA BERSIH HUB                  */}
      {/* ========================================================= */}
      {activeTab === "KEUANGAN" && (
        <section className="space-y-6">
          {/* Header Bar Keuangan */}
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
              <span>+</span> Catat Biaya Operasional Toko
            </button>
          </div>

          {/* 3 Kartu Ringkasan Keuangan Hub */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Total Omzet Restoran */}
            <div className="bg-white p-5 rounded-lg border border-emerald-200 shadow-xs relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  1. Total Pendapatan (Omzet)
                </span>
                <span className="text-emerald-600 text-base">🟢</span>
              </div>
              <p className="text-2xl font-black text-gray-900 mt-2">
                Rp {filteredFinancialData.totalRevenue.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Dari {filteredFinancialData.sales.length} item pesanan bahan ke restoran
              </p>
            </div>

            {/* 2. Total Pengeluaran */}
            <div className="bg-white p-5 rounded-lg border border-rose-200 shadow-xs relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                  2. Total Pengeluaran Toko
                </span>
                <span className="text-rose-600 text-base">🔴</span>
              </div>
              <p className="text-2xl font-black text-rose-600 mt-2">
                Rp {filteredFinancialData.totalExpense.toLocaleString("id-ID")}
              </p>
              <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                <span>
                  Beli dari Petani (HPP): Rp {filteredFinancialData.totalFarmerCost.toLocaleString("id-ID")}
                </span>
                <span>
                  Operasional Toko: Rp {filteredFinancialData.totalManualExpense.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* 3. Margin Keuntungan Bersih Hub */}
            <div className="bg-white p-5 rounded-lg border-2 border-emerald-500 shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  3. Untung Bersih (Margin Toko)
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Margin {filteredFinancialData.profitMarginPercent}%
                </span>
              </div>
              <p
                className={`text-2xl font-black mt-2 ${
                  filteredFinancialData.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                Rp {filteredFinancialData.netProfit.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-gray-600 mt-1">Keuntungan bersih yang diperoleh Toko Hub</p>
            </div>
          </div>

          {/* Rincian Arus Kas Hub */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabel Penjualan Bahan (Pemasukan) */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">↑</span> Rincian Penjualan Bahan ke Restoran
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {filteredFinancialData.sales.length} item
                </span>
              </div>

              {filteredFinancialData.sales.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Belum ada transaksi penjualan pada periode ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredFinancialData.sales.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-md border border-gray-100 bg-gray-50/60 flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900">
                          {item.productName}{" "}
                          <span className="text-gray-500 font-normal">
                            ({item.quantity} {item.unit})
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {new Date(item.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          • Pemesan: <strong className="text-gray-700">{item.buyerName}</strong>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Beli Rp {item.farmerCostPerUnit.toLocaleString("id-ID")} → Jual Rp{" "}
                          {item.pricePerUnit.toLocaleString("id-ID")}/{item.unit}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-emerald-600">
                          + Rp {item.revenue.toLocaleString("id-ID")}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Margin: Rp {item.netMargin.toLocaleString("id-ID")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabel Catatan Biaya Operasional Toko (Pengeluaran Mandiri) */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="text-rose-600 font-bold">↓</span> Biaya Operasional Toko Hub
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {filteredFinancialData.manualExpenses.length} catatan
                </span>
              </div>

              {filteredFinancialData.manualExpenses.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Belum ada catatan biaya operasional toko. Klik{" "}
                  <button
                    onClick={() => setIsAddingExpense(true)}
                    className="text-emerald-600 font-medium underline"
                  >
                    + Catat Biaya Operasional
                  </button>{" "}
                  untuk mencatat bensin armada atau plastik packing.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredFinancialData.manualExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-2.5 rounded-md border border-gray-100 bg-gray-50/60 flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span>{exp.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-normal bg-gray-200 text-gray-700">
                            {exp.category === "LOGISTIK"
                              ? "Logistik / Bensin"
                              : exp.category === "OPERASIONAL"
                              ? "Operasional Toko"
                              : exp.category}
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
                          title="Hapus biaya operasional ini"
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
        </section>
      )}

      {/* Modal Catat Biaya Operasional Toko Hub */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Catat Biaya Operasional Toko</h3>
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
                  Keterangan Biaya
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Bensin Kurir Armada / Plastik Packing"
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
                    placeholder="cth: 50000"
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
                    <option value="LOGISTIK">Bensin & Kurir</option>
                    <option value="OPERASIONAL">Operasional & Packing</option>
                    <option value="LAINNYA">Lain-lain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal</label>
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
                  placeholder="cth: Pengantaran pesanan ke resto Senopati"
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
                  {loading ? "Menyimpan..." : "Simpan Biaya"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Hapus Biaya Operasional Hub */}
      <ConfirmDialog
        isOpen={!!deleteExpenseTarget}
        title="Hapus Catatan Pengeluaran Toko?"
        description={`Biaya operasional "${deleteExpenseTarget?.title}" sebesar Rp ${deleteExpenseTarget?.amount.toLocaleString(
          "id-ID"
        )} akan dihapus dari catatan keuangan.`}
        confirmText="Hapus Biaya"
        cancelText="Batal"
        isDanger
        isLoading={loading}
        onConfirm={() => {
          if (deleteExpenseTarget) handleDeleteExpense(deleteExpenseTarget.id);
        }}
        onCancel={() => setDeleteExpenseTarget(null)}
      />

      {/* Modal Edit Produk Toko */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md p-5 max-w-md w-full border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Edit: {editingProduct.name}</h3>
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
                  Harga beli modal petani: Rp {editingProduct.priceFarmer.toLocaleString("id-ID")}
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
                {compressing && <p className="text-[10px] text-gray-500 mt-1">Mengompres foto...</p>}
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
