"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { completeOrderAction, createProductReviewAction } from "./actions";
import { simulatePaymentAction } from "../actions";
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
  courierName?: string | null;
  courierPhone?: string | null;
  vehicleNumber?: string | null;
  estimatedArrival?: string | null;
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
    province?: string;
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

  // State Modal Pembayaran (Mock Payment Gateway)
  const [payingOrder, setPayingOrder] = useState<OrderData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"QRIS" | "TRANSFER_BANK" | "E_WALLET">("QRIS");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // State Modal Cetak Invoice
  const [invoiceOrder, setInvoiceOrder] = useState<OrderData | null>(null);

  // State Modal Selesai & Upload Foto Penerimaan
  const [completingOrder, setCompletingOrder] = useState<OrderData | null>(null);
  const [receiveImage, setReceiveImage] = useState<File | null>(null);
  const [receivePreview, setReceivePreview] = useState<string | null>(null);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // State Modal Review
  const [reviewingProductId, setReviewingProductId] = useState<string | null>(null);
  const [reviewingProductName, setReviewingProductName] = useState<string>("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const isImageValid = (imageUrl?: string | null, expiresAt?: Date | string | null) => {
    if (!imageUrl || !expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MENUNGGU_PEMBAYARAN":
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            Menunggu Pembayaran
          </span>
        );
      case "DIPROSES_HUB":
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            Diproses Hub
          </span>
        );
      case "DIKIRIM":
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            Dalam Pengiriman
          </span>
        );
      case "SELESAI":
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            Selesai
          </span>
        );
      case "DIBATALKAN":
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            Dibatalkan
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  // Handler Simulasi Bayar
  const handlePayOrder = async () => {
    if (!payingOrder) return;
    setIsProcessingPayment(true);
    setMsg(null);

    const res = await simulatePaymentAction(payingOrder.id, paymentMethod);
    setIsProcessingPayment(false);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === payingOrder.id
            ? {
                ...o,
                status: "DIPROSES_HUB",
                payment: {
                  method: paymentMethod,
                  status: "LUNAS",
                  amount: o.finalAmount,
                },
              }
            : o
        )
      );
      setPayingOrder(null);
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  // Handler Kompresi Foto Bukti Terima
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setCompressing(true);
        const compressed = await compressImage(file, 800, 800, 0.7);
        setReceiveImage(compressed);
        setReceivePreview(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Gagal kompres:", err);
        setReceiveImage(file);
        setReceivePreview(URL.createObjectURL(file));
      } finally {
        setCompressing(false);
      }
    }
  };

  // Handler Konfirmasi Penerimaan Barang
  const handleConfirmReceived = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingOrder) return;

    setSubmittingComplete(true);
    setMsg(null);

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
      setOrders((prev) =>
        prev.map((o) =>
          o.id === completingOrder.id ? { ...o, status: "SELESAI", receivedAt: new Date() } : o
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

  // Handler Review
  const handleSubmitReview = async (e: React.FormEvent) => {
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
      setRating(5);
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Riwayat Pesanan Restoran
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Pantau status pesanan, pembayaran, dan pengiriman.
          </p>
        </div>

        <Link
          href="/restoran"
          className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-md text-xs hover:bg-emerald-700"
        >
          Kembali Belanja
        </Link>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-md text-xs font-medium border flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            msg.success
              ? "bg-emerald-50/70 text-emerald-800 border-emerald-200"
              : "bg-rose-50/70 text-rose-800 border-rose-200"
          }`}
        >
          <span>{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="text-gray-400 hover:text-gray-600 p-1 text-xs cursor-pointer"
            title="Tutup"
          >
            ✕
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white p-6 text-center rounded-md border border-gray-200">
          <p className="font-medium text-slate-700 text-sm">Belum ada riwayat pesanan</p>
          <p className="text-xs text-slate-400 mt-1">Pilih komoditas di katalog bahan restoran.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((ord) => {
            const isDelivering = ord.status === "DIKIRIM";
            const isCompleted = ord.status === "SELESAI";
            const isWaitingPayment = ord.status === "MENUNGGU_PEMBAYARAN";
            const hasCourier = ord.courierName || ord.vehicleNumber;

            return (
              <div
                key={ord.id}
                className="bg-white rounded-md border border-gray-200 overflow-hidden p-4 space-y-3"
              >
                {/* Header Kartu Pesanan */}
                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">#{ord.orderNumber}</span>
                      {getStatusBadge(ord.status)}
                    </div>
                    <span className="text-xs text-slate-400">
                      Dibuat: {new Date(ord.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <button
                      onClick={() => setInvoiceOrder(ord)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-700 font-medium rounded-md text-xs cursor-pointer"
                    >
                      Cetak Nota
                    </button>

                    {isWaitingPayment && (
                      <button
                        onClick={() => {
                          setPayingOrder(ord);
                          setPaymentMethod((ord.payment?.method as any) || "QRIS");
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-xs cursor-pointer"
                      >
                        Bayar Sekarang
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Toko Hub & Alamat */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-md border border-gray-200">
                  <div>
                    <span className="text-slate-400 text-xs font-medium block">
                      Toko Hub Pemasok
                    </span>
                    <p className="font-medium text-slate-800 text-sm mt-0.5">{ord.hub.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Metode Bayar:{" "}
                      <strong className="text-slate-700 font-mono">
                        {ord.payment?.method || "TRANSFER"} ({ord.payment?.status || "PENDING"})
                      </strong>
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 text-xs font-medium block">
                      Alamat Tujuan Restoran
                    </span>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {ord.deliveryAddress?.label || "Dapur Restoran"}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {ord.deliveryAddress?.street}, {ord.deliveryAddress?.city}
                    </p>
                  </div>
                </div>

                {/* Info Kurir & Pelacakan Armada Hub jika ada */}
                {hasCourier && (
                  <div className="p-3 bg-white border border-gray-200 rounded-md text-xs space-y-1">
                    <span className="font-medium text-slate-900 block">
                      Armada Pengantaran Hub:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 pt-1">
                      <div>
                        Kurir: <strong>{ord.courierName || "-"}</strong>
                      </div>
                      <div>
                        No. HP: <strong>{ord.courierPhone || "-"}</strong>
                      </div>
                      <div>
                        Plat: <strong>{ord.vehicleNumber || "-"}</strong>
                      </div>
                      <div>
                        Estimasi Tiba: <strong>{ord.estimatedArrival || "~45 Menit"}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rincian Produk Pesanan */}
                <div className="divide-y divide-gray-200">
                  {ord.items.map((it) => (
                    <div key={it.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-slate-900">{it.product.name}</p>
                        <p className="text-slate-500 text-xs">
                          {it.quantity} {it.product.unit} × Rp {it.pricePerUnit.toLocaleString("id-ID")}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-800">
                          Rp {it.subtotal.toLocaleString("id-ID")}
                        </span>
                        {isCompleted && (
                          <button
                            onClick={() => {
                              setReviewingProductId(it.product.id);
                              setReviewingProductName(it.product.name);
                            }}
                            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-md font-medium border border-gray-200"
                          >
                            Beri Nilai
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Total & Tombol Terima Barang */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-t border-gray-200 pt-3">
                  <div className="text-xs text-slate-500">
                    <span>
                      Ongkir: Rp {ord.deliveryFee.toLocaleString("id-ID")} | Total:{" "}
                    </span>
                    <strong className="text-sm text-emerald-700 font-bold">
                      Rp {ord.finalAmount.toLocaleString("id-ID")}
                    </strong>
                  </div>

                  {isDelivering && (
                    <button
                      onClick={() => setCompletingOrder(ord)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-xs cursor-pointer"
                    >
                      Konfirmasi Barang Diterima
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Simulasi Pembayaran (Payment Gateway Sandbox) */}
      {payingOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Simulasi Pembayaran
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Sandbox
                </span>
              </div>
              <button
                onClick={() => setPayingOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-medium"
              >
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-md border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Nomor Pesanan:</span>
                <span className="font-mono font-medium text-slate-800">#{payingOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Toko Hub Tujuan:</span>
                <span className="font-medium text-slate-800">{payingOrder.hub.name}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-gray-200">
                <span>Total Tagihan:</span>
                <span className="text-emerald-700">Rp {payingOrder.finalAmount.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* Pilihan Metode Bayar */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Pilih Saluran Pembayaran:</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["QRIS", "TRANSFER_BANK", "E_WALLET"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-md font-medium border text-center ${
                      paymentMethod === m
                        ? "bg-white border-emerald-600 text-emerald-700"
                        : "bg-white border-gray-200 text-slate-600"
                    }`}
                  >
                    {m === "QRIS" ? "QRIS" : m === "TRANSFER_BANK" ? "Bank VA" : "E-Wallet"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tampilan Visual Mockup */}
            <div className="p-4 bg-white rounded-md border border-gray-200 text-center space-y-2">
              {paymentMethod === "QRIS" && (
                <div className="space-y-1">
                  <div className="w-32 h-32 mx-auto bg-white p-2 rounded-md border border-gray-200 flex items-center justify-center font-mono text-xs text-slate-500">
                    [ QRIS CODE ]
                  </div>
                  <p className="text-xs text-slate-600">
                    Scan QRIS via BCA, GoPay, OVO, atau ShopeePay
                  </p>
                </div>
              )}
              {paymentMethod === "TRANSFER_BANK" && (
                <div className="space-y-1 text-xs">
                  <span className="text-slate-500 text-xs">Virtual Account BCA (Simulasi)</span>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    8801 2026 {payingOrder.orderNumber.slice(-4)}
                  </p>
                </div>
              )}
              {paymentMethod === "E_WALLET" && (
                <p className="text-xs text-slate-600">
                  Notifikasi push pembayaran akan dialihkan ke aplikasi E-Wallet Anda.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                className="flex-1 py-2 text-xs font-medium text-slate-600 bg-gray-100 rounded-md"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePayOrder}
                disabled={isProcessingPayment}
                className="flex-2 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
              >
                {isProcessingPayment ? "Memverifikasi..." : "Simulasi Bayar Berhasil (Sandbox)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Invoice / Nota Digital */}
      {invoiceOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-xl p-4 space-y-4 max-h-[95vh] overflow-y-auto print:p-0 print:border-0">
            {/* Header Nota */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">AgriApp Indonesia</h2>
                <p className="text-xs text-slate-500">Nota Transaksi Pengiriman</p>
              </div>

              <div className="text-right">
                <p className="font-mono font-bold text-slate-900 text-sm">
                  #{invoiceOrder.orderNumber}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(invoiceOrder.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-slate-700">
                  Status: {invoiceOrder.payment?.status || "LUNAS"}
                </span>
              </div>
            </div>

            {/* Info Pembeli & Penjual */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium block text-xs">
                  Penyedia (Toko Hub)
                </span>
                <p className="font-medium text-slate-800 mt-1">{invoiceOrder.hub.name}</p>
                <p className="text-slate-500 text-xs">Mitra Pengumpul AgriApp</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium block text-xs">
                  Penerima (Restoran)
                </span>
                <p className="font-medium text-slate-800 mt-1">
                  {invoiceOrder.deliveryAddress?.recipientName || "Restoran"}
                </p>
                <p className="text-slate-500 text-xs">
                  {invoiceOrder.deliveryAddress?.street}, {invoiceOrder.deliveryAddress?.city}
                </p>
                <p className="text-slate-500 text-xs">
                  Telp: {invoiceOrder.deliveryAddress?.phoneNumber}
                </p>
              </div>
            </div>

            {/* Tabel Item */}
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="p-2.5 text-gray-500 text-xs font-medium">Bahan</th>
                    <th className="p-2.5 text-center text-gray-500 text-xs font-medium">Qty</th>
                    <th className="p-2.5 text-right text-gray-500 text-xs font-medium">Harga Satuan</th>
                    <th className="p-2.5 text-right text-gray-500 text-xs font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoiceOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 font-medium text-slate-800">{it.product.name}</td>
                      <td className="p-2.5 text-center">
                        {it.quantity} {it.product.unit}
                      </td>
                      <td className="p-2.5 text-right">
                        Rp {it.pricePerUnit.toLocaleString("id-ID")}
                      </td>
                      <td className="p-2.5 text-right font-medium">
                        Rp {it.subtotal.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Calculation */}
            <div className="space-y-1.5 text-xs text-slate-600 text-right">
              <p>
                Subtotal Produk:{" "}
                <span className="font-medium">
                  Rp {invoiceOrder.totalAmount.toLocaleString("id-ID")}
                </span>
              </p>
              <p>
                Ongkos Kirim Hub:{" "}
                <span className="font-medium">
                  Rp {invoiceOrder.deliveryFee.toLocaleString("id-ID")}
                </span>
              </p>
              <p className="text-sm font-bold text-slate-900 pt-2 border-t border-gray-200">
                Total Tagihan:{" "}
                <span className="text-emerald-700">
                  Rp {invoiceOrder.finalAmount.toLocaleString("id-ID")}
                </span>
              </p>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 print:hidden">
              <button
                onClick={() => setInvoiceOrder(null)}
                className="flex-1 py-2 text-xs font-medium text-slate-600 bg-gray-100 rounded-md"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                Cetak / Print PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Selesai & Upload Bukti Penerimaan */}
      {completingOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Konfirmasi Terima Barang</h3>
              <button
                onClick={() => setCompletingOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReceived} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Foto Bukti Kondisi Bahan (Berlaku 24 Jam)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-slate-700"
                />
                {receivePreview && (
                  <div className="mt-2 h-28 w-full rounded-md overflow-hidden border border-gray-200">
                    <img src={receivePreview} alt="Preview Terima" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Penerimaan</label>
                <textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Bahan diterima dalam keadaan segar dan lengkap."
                  className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500 h-20"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setCompletingOrder(null)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 bg-gray-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete || compressing}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                >
                  {submittingComplete ? "Menyimpan..." : "Konfirmasi Selesai"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Review */}
      {reviewingProductId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Ulas Produk</h3>
              <button
                onClick={() => setReviewingProductId(null)}
                className="text-slate-400 hover:text-slate-600 font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <p className="text-xs font-medium text-slate-800">
                Produk: <span className="text-emerald-700">{reviewingProductName}</span>
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-2xl cursor-pointer ${
                        rating >= star ? "text-amber-400" : "text-slate-200"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ulasan Anda</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tulis ulasan Anda di sini."
                  className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500 h-20"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setReviewingProductId(null)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 bg-gray-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                >
                  {isSubmittingReview ? "Mengirim..." : "Kirim Ulasan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
