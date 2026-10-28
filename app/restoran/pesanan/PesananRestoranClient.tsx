"use client";

import { useState } from "react";
import Link from "next/link";
import { completeOrderAction, createProductReviewAction } from "./actions";
import { compressImage } from "@/lib/compressImage";

interface OrderItem {
  id: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
  product: {
    id: string;
    name: string;
    unit: string;
    imageUrl?: string | null;
  };
}

interface OrderData {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  deliveryFee: number;
  finalAmount: number;
  notes?: string | null;
  receivedImageUrl?: string | null;
  receivedImageExpiresAt?: Date | string | null;
  receivedNotes?: string | null;
  receivedAt?: Date | string | null;
  createdAt: Date | string;
  hub: { id: string; name: string };
  deliveryAddress?: {
    label: string;
    recipientName: string;
    phoneNumber: string;
    street: string;
    city: string;
  } | null;
  payment?: {
    method: string;
    status: string;
    amount: number;
  } | null;
  items: OrderItem[];
}

export default function PesananRestoranClient({ initialOrders }: { initialOrders: any[] }) {
  const [orders, setOrders] = useState<OrderData[]>(initialOrders);
  
  // State Modal Selesai & Upload Foto Penerimaan
  const [completingOrder, setCompletingOrder] = useState<OrderData | null>(null);
  const [receiveImage, setReceiveImage] = useState<File | null>(null);
  const [receivePreview, setReceivePreview] = useState<string | null>(null);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // State Modal Review
  const [reviewingProductId, setReviewingProductId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);

  const isImageValid = (imageUrl?: string | null, expiresAt?: Date | string | null) => {
    if (!imageUrl || !expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MENUNGGU_PEMBAYARAN":
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">Menunggu Pembayaran</span>;
      case "DIPROSES_HUB":
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-semibold">Sedang Dipersiapkan Hub</span>;
      case "DIKIRIM":
        return (
          <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <span className="animate-pulse">🚚</span> Dalam Pengiriman (Estimasi ~1 Jam)
          </span>
        );
      case "SELESAI":
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold">✓ Barang Diterima & Selesai</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setCompressing(true);
        // Otomatis kompres foto barang yang diterima
        const compressed = await compressImage(file, 1200, 1200, 0.75);
        setReceiveImage(compressed);
        setReceivePreview(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Gagal kompres foto penerimaan:", err);
        setReceiveImage(file);
        setReceivePreview(URL.createObjectURL(file));
      } finally {
        setCompressing(false);
      }
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingOrder) return;

    setSubmittingComplete(true);
    const formData = new FormData();
    formData.append("orderId", completingOrder.id);
    formData.append("notes", receiveNotes);
    if (receiveImage) {
      formData.append("image", receiveImage);
    }

    const res = await completeOrderAction(formData);
    setSubmittingComplete(false);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      // Update state order lokal
      setOrders((prev) =>
        prev.map((o) =>
          o.id === completingOrder.id
            ? {
                ...o,
                status: "SELESAI",
                receivedImageUrl: receivePreview,
                receivedNotes: receiveNotes,
                receivedAt: new Date().toISOString(),
              }
            : o
        )
      );
      setCompletingOrder(null);
      setReceiveImage(null);
      setReceivePreview(null);
      setReceiveNotes("");
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingProductId) return;

    setIsSubmittingReview(true);
    const formData = new FormData();
    formData.append("productId", reviewingProductId);
    formData.append("rating", rating.toString());
    formData.append("comment", comment);

    const res = await createProductReviewAction(formData);
    setIsSubmittingReview(false);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setReviewingProductId(null);
      setComment("");
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Pesanan Restoran</h1>
          <p className="text-sm text-gray-500">
            Daftar pesanan bahan baku dari Toko Hub. Cek status perjalanan dan konfirmasi penerimaan barang.
          </p>
        </div>
        <Link
          href="/restoran"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition cursor-pointer"
        >
          + Belanja Bahan Lagi
        </Link>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border ${
            msg.success
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-gray-300 space-y-3">
          <div className="text-4xl">🧾</div>
          <h3 className="font-bold text-gray-800">Belum Ada Transaksi Pesanan</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Semua pesanan bahan baku yang kamu checkout di etalase toko akan otomatis tercatat dan diproses di sini.
          </p>
          <Link
            href="/restoran"
            className="inline-block px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
          >
            Buka Katalog Restoran
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((ord) => {
            const hasValidReceivedPhoto = isImageValid(ord.receivedImageUrl, ord.receivedImageExpiresAt);

            return (
              <div
                key={ord.id}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 hover:shadow-md transition"
              >
                {/* Header Card Order */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-gray-900 text-base">#{ord.orderNumber}</span>
                      {getStatusBadge(ord.status)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Diproses oleh <strong>{ord.hub.name}</strong> •{" "}
                      {new Date(ord.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Status Pembayaran & Tombol Konfirmasi Selesai */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${
                          ord.payment?.status === "LUNAS"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        💳 {ord.payment?.status || "LUNAS"} ({ord.payment?.method || "TRANSFER"})
                      </span>
                    </div>

                    {/* Tombol Penyelesaian Jika Sedang Dikirim */}
                    {ord.status === "DIKIRIM" && (
                      <button
                        onClick={() => {
                          setCompletingOrder(ord);
                          setReceiveImage(null);
                          setReceivePreview(null);
                          setReceiveNotes("");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        📦 Barang Diterima (Selesai)
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner Bukti Penerimaan Barang jika Pesanan Sudah Selesai */}
                {ord.status === "SELESAI" && (
                  <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {hasValidReceivedPhoto ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-400 shrink-0">
                          <img
                            src={ord.receivedImageUrl!}
                            alt="Bukti Penerimaan"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-xl border">
                          ✅
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-emerald-900">
                          Konfirmasi Penerimaan Barang Berhasil
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          Catatan Resto: {ord.receivedNotes || "Bahan diterima lengkap & segar."}
                        </div>
                        {hasValidReceivedPhoto && (
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            ⏱️ Foto bukti penerimaan aktif selama 24 jam
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rincian Order Items */}
                <div className="divide-y divide-gray-100">
                  {ord.items.map((it) => (
                    <div key={it.id} className="py-2.5 flex justify-between items-center text-sm">
                      <div>
                        <span className="font-semibold text-gray-800">{it.product.name}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          x {it.quantity} {it.product.unit} @ Rp {it.pricePerUnit.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-900">
                          Rp {it.subtotal.toLocaleString("id-ID")}
                        </span>
                        <button
                          onClick={() => setReviewingProductId(it.product.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                        >
                          Beri Ulasan ⭐
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Total & Lokasi Pengantaran */}
                <div className="bg-gray-50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs text-gray-600 border border-gray-100">
                  <div>
                    <span className="font-semibold text-gray-800">📍 Lokasi Antar: </span>
                    {ord.deliveryAddress ? (
                      <span>
                        {ord.deliveryAddress.label} - {ord.deliveryAddress.street},{" "}
                        {ord.deliveryAddress.city}
                      </span>
                    ) : (
                      <span>Dapur Restoran Utama</span>
                    )}
                    {ord.notes && (
                      <div className="text-gray-500 italic mt-0.5">Catatan: &ldquo;{ord.notes}&rdquo;</div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-gray-500">
                      Ongkir: Rp {ord.deliveryFee.toLocaleString("id-ID")}
                    </div>
                    <div className="text-base font-bold text-emerald-700">
                      Total: Rp {ord.finalAmount.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Penerimaan Barang & Upload Foto 24 Jam */}
      {completingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">
                Konfirmasi Penerimaan Barang #{completingOrder.orderNumber}
              </h3>
              <button
                onClick={() => setCompletingOrder(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Apakah semua bahan pesanan sudah kamu terima dari kurir Hub dalam kondisi baik?
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex justify-between items-center">
                  <span>Foto Bukti Fisik Penerimaan</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Auto-Kompres ⚡ (24 Jam)
                  </span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={compressing}
                  className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer disabled:opacity-50"
                />
                {compressing && (
                  <p className="text-[11px] text-blue-600 mt-1">Mengompres foto bukti...</p>
                )}
                {receivePreview && !compressing && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border w-full h-32">
                    <img
                      src={receivePreview}
                      alt="Preview Penerimaan"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                      Ukuran: {((receiveImage?.size || 0) / 1024).toFixed(0)} KB (Optimal)
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catatan Kondisi Barang
                </label>
                <textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Contoh: Sayuran segar, timbangan sesuai, pengemasan rapi."
                  className="w-full border rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingOrder(null)}
                  className="flex-1 py-2.5 rounded-lg border text-gray-600 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete || compressing}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingComplete ? "Memproses..." : "Konfirmasi Selesai ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Review Ulasan Produk */}
      {reviewingProductId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Beri Ulasan Kualitas Bahan ⭐</h3>
            <form onSubmit={handleReviewSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Rating Kesegaran (1-5 Bintang)
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5 - Sangat Segar & Bagus)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 - Bagus)</option>
                  <option value={3}>⭐⭐⭐ (3 - Cukup)</option>
                  <option value={2}>⭐⭐ (2 - Kurang Segar)</option>
                  <option value={1}>⭐ (1 - Rusak / Buruk)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catatan Kualitas
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ceritakan kondisi bahan baku saat diterima..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingProductId(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReview ? "Menyimpan..." : "Kirim Ulasan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
