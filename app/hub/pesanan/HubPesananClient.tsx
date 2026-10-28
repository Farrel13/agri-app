"use client";

import { useState } from "react";
import Link from "next/link";
import { updateOrderStatusAction, verifyOrderPaymentAction } from "./actions";

export default function HubPesananClient({ initialOrders }: { initialOrders: any[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setLoadingId(orderId);
    setMsg(null);
    const res = await updateOrderStatusAction(orderId, newStatus);
    setLoadingId(null);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  const handleVerifyPayment = async (orderId: string) => {
    setLoadingId(orderId);
    setMsg(null);
    const res = await verifyOrderPaymentAction(orderId);
    setLoadingId(null);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "DIPROSES_HUB", payment: { ...o.payment, status: "LUNAS" } }
            : o
        )
      );
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Pesanan Masuk (Hub)</h1>
          <p className="text-sm text-gray-500">
            Kelola pesanan dari restoran, periksa bukti bayar, dan update status pengiriman bahan.
          </p>
        </div>
        <Link
          href="/hub"
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-lg transition"
        >
          ← Kembali ke Dashboard Verifikasi
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
          <div className="text-4xl">📦</div>
          <h3 className="font-bold text-gray-800">Belum Ada Pesanan Masuk</h3>
          <p className="text-xs text-gray-500">
            Pesanan dari restoran yang membeli bahan di toko kamu akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-900 text-lg">
                      #{ord.orderNumber}
                    </span>
                    <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded font-semibold">
                      Restoran: {ord.buyer?.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Dipesan pada: {new Date(ord.createdAt).toLocaleString("id-ID")}
                  </div>
                </div>

                {/* Status Pembayaran */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Pembayaran:</div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        ord.payment?.status === "LUNAS"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ord.payment?.status || "PENDING"} ({ord.payment?.method || "TRANSFER"})
                    </span>
                  </div>

                  {ord.payment?.status !== "LUNAS" && (
                    <button
                      onClick={() => handleVerifyPayment(ord.id)}
                      disabled={loadingId === ord.id}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >
                      Konfirmasi Lunas ✅
                    </button>
                  )}
                </div>
              </div>

              {/* Rincian Produk Pesanan */}
              <div className="bg-gray-50 p-4 rounded-xl divide-y divide-gray-200">
                <div className="text-xs font-bold text-gray-700 pb-2">Rincian Barang Pesanan:</div>
                {ord.items.map((it: any) => (
                  <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-medium text-gray-800">{it.product.name}</span>
                      <span className="text-gray-500 ml-2">
                        x {it.quantity} {it.product.unit} (@ Rp {it.pricePerUnit.toLocaleString("id-ID")})
                      </span>
                    </div>
                    <div className="font-semibold text-gray-800">
                      Rp {it.subtotal.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex justify-between text-xs font-bold text-gray-900">
                  <span>Total Tagihan (Termasuk Ongkir Rp {ord.deliveryFee.toLocaleString("id-ID")}):</span>
                  <span className="text-emerald-700 text-sm">
                    Rp {ord.finalAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Footer Alamat & Ubah Status Order */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-2">
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">📍 Kirim ke: </span>
                  {ord.deliveryAddress ? (
                    <span>
                      {ord.deliveryAddress.label} - {ord.deliveryAddress.street},{" "}
                      {ord.deliveryAddress.city} (Penerima: {ord.deliveryAddress.recipientName} / {ord.deliveryAddress.phoneNumber})
                    </span>
                  ) : (
                    <span>Dapur Restoran</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Ubah Status:</span>
                  <select
                    value={ord.status}
                    onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                    disabled={loadingId === ord.id}
                    className="border border-gray-300 rounded-lg text-xs p-1.5 bg-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MENUNGGU_PEMBAYARAN">Menunggu Pembayaran</option>
                    <option value="DIPROSES_HUB">Sedang Diproses Hub</option>
                    <option value="DIKIRIM">Sedang Dikirim</option>
                    <option value="SELESAI">Selesai</option>
                    <option value="DIBATALKAN">Dibatalkan</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
