"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  updateOrderStatusAction,
  dispatchOrderAction,
  verifyOrderPaymentAction,
} from "./actions";

interface OrderItem {
  id: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
  product: {
    id: string;
    name: string;
    unit: string;
    priceFarmer: number;
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
  createdAt: Date | string;
  buyer: { id: string; name: string; email?: string | null };
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
  orderCost: number;
  orderProfit: number;
}

interface HubPesananClientProps {
  initialOrders: OrderData[];
  financialStats: {
    totalOrders: number;
    completedOrdersCount: number;
    totalRevenue: number;
    totalFarmerCost: number;
    netProfit: number;
    profitMarginPercent: number;
  };
}

export default function HubPesananClient({
  initialOrders,
  financialStats,
}: HubPesananClientProps) {
  const [orders, setOrders] = useState<OrderData[]>(initialOrders);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  // State Modal Pengiriman & Kurir
  const [dispatchingOrder, setDispatchingOrder] = useState<OrderData | null>(null);
  const [courierName, setCourierName] = useState("");
  const [courierPhone, setCourierPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("45 Menit");
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

  // State Modal Cetak Surat Jalan
  const [printOrder, setPrintOrder] = useState<OrderData | null>(null);

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
            ? { ...o, status: "DIPROSES_HUB", payment: { ...o.payment!, status: "LUNAS" } }
            : o
        )
      );
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchingOrder) return;

    setIsSubmittingDispatch(true);
    setMsg(null);

    const formData = new FormData();
    formData.append("orderId", dispatchingOrder.id);
    formData.append("courierName", courierName || "Kurir Internal Hub");
    formData.append("courierPhone", courierPhone || "-");
    formData.append("vehicleNumber", vehicleNumber || "B 1234 XYZ");
    formData.append("estimatedArrival", estimatedArrival || "45 Menit");

    const res = await dispatchOrderAction(formData);
    setIsSubmittingDispatch(false);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === dispatchingOrder.id
            ? {
                ...o,
                status: "DIKIRIM",
                courierName,
                courierPhone,
                vehicleNumber,
                estimatedArrival,
              }
            : o
        )
      );
      setDispatchingOrder(null);
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Pesanan Masuk dan Laporan Margin Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pantau pendapatan, kelola kurir, dan verifikasi pembayaran.
          </p>
        </div>

        <Link
          href="/hub"
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-4 py-2 rounded-md transition"
        >
          Etalase dan Verifikasi Panen
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

      {/* Ringkasan Finansial / Margin Hub */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Omzet Penjualan
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">
            Rp {financialStats.totalRevenue.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-gray-400 mt-0.5 block">Dari pesanan terverifikasi</span>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Modal Beli Petani
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">
            Rp {financialStats.totalFarmerCost.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-gray-400 mt-0.5 block">Kewajiban bayar ke petani</span>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200 border-l-4 border-l-emerald-500">
          <span className="text-xs font-medium text-gray-500 block">
            Laba Bersih Hub
          </span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            Rp {financialStats.netProfit.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-gray-500 mt-0.5 block">
            Margin: {financialStats.profitMarginPercent}%
          </span>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Total Transaksi
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{financialStats.totalOrders} Pesanan</p>
          <span className="text-xs text-gray-400 mt-0.5 block">
            {financialStats.completedOrdersCount} Selesai Diterima
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white p-4 text-center rounded-md border border-dashed border-gray-300">
          <h3 className="font-medium text-gray-800 mt-2">Belum Ada Pesanan Masuk</h3>
          <p className="text-xs text-gray-400 mt-1">
            Pesanan dari restoran akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((ord) => {
            const isPendingPayment = ord.payment?.status !== "LUNAS";
            const canDispatch = ord.status === "DIPROSES_HUB";
            const isDelivering = ord.status === "DIKIRIM";
            const isDone = ord.status === "SELESAI";

            return (
              <div
                key={ord.id}
                className="bg-white border border-gray-200 rounded-md p-4 space-y-3"
              >
                {/* Header Card */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">#{ord.orderNumber}</span>
                      <span className="bg-white text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-200 font-medium">
                        {ord.buyer?.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          ord.status === "SELESAI"
                            ? "bg-emerald-600 text-white"
                            : ord.status === "DIKIRIM"
                            ? "bg-gray-700 text-white"
                            : ord.status === "DIPROSES_HUB"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      Waktu Pesan: {new Date(ord.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPrintOrder(ord)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition cursor-pointer"
                    >
                      Surat Jalan
                    </button>

                    {isPendingPayment && (
                      <button
                        onClick={() => handleVerifyPayment(ord.id)}
                        disabled={loadingId === ord.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition disabled:opacity-50"
                      >
                        Konfirmasi Lunas
                      </button>
                    )}

                    {canDispatch && (
                      <button
                        onClick={() => {
                          setDispatchingOrder(ord);
                          setCourierName("");
                          setCourierPhone("");
                          setVehicleNumber("");
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-md transition"
                      >
                        Kirim via Kurir
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Alamat & Kurir */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs border border-gray-100 p-3 rounded-md">
                  <div>
                    <span className="text-gray-400 font-medium text-xs block">
                      Tujuan Antar
                    </span>
                    <p className="font-medium text-gray-800 mt-0.5">
                      {ord.deliveryAddress?.label || "Dapur Restoran"} ({ord.deliveryAddress?.recipientName})
                    </p>
                    <p className="text-gray-500 text-xs">
                      {ord.deliveryAddress?.street}, {ord.deliveryAddress?.city}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Kontak: {ord.deliveryAddress?.phoneNumber}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-medium text-xs block">
                      Status Logistik
                    </span>
                    {ord.courierName ? (
                      <div className="text-xs text-gray-700 mt-0.5 space-y-0.5">
                        <p>
                          Kurir: <strong>{ord.courierName}</strong> ({ord.courierPhone})
                        </p>
                        <p>
                          Kendaraan: <strong>{ord.vehicleNumber}</strong> | Est:{" "}
                          <strong>{ord.estimatedArrival}</strong>
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-xs mt-0.5">
                        Belum diberangkatkan (menunggu armada kurir).
                      </p>
                    )}
                  </div>
                </div>

                {/* Item Produk & Rincian Margin per Pesanan */}
                <div className="border border-gray-200 rounded-md overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="text-gray-500 border-b border-gray-200 text-xs font-medium">
                      <tr>
                        <th className="p-2.5">Bahan</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Modal Tani</th>
                        <th className="p-2.5 text-right">Harga Toko</th>
                        <th className="p-2.5 text-right">Margin Toko</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ord.items.map((it) => {
                        const farmerCost = it.quantity * (it.product?.priceFarmer || 0);
                        const margin = it.subtotal - farmerCost;
                        return (
                          <tr key={it.id}>
                            <td className="p-2.5 font-medium text-gray-800">{it.product.name}</td>
                            <td className="p-2.5 text-center">
                              {it.quantity} {it.product.unit}
                            </td>
                            <td className="p-2.5 text-right text-gray-500">
                              Rp {farmerCost.toLocaleString("id-ID")}
                            </td>
                            <td className="p-2.5 text-right font-medium text-gray-800">
                              Rp {it.subtotal.toLocaleString("id-ID")}
                            </td>
                            <td className="p-2.5 text-right font-medium text-emerald-600">
                              +Rp {margin.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Total */}
                <div className="flex flex-wrap justify-between items-center text-xs pt-1">
                  <div className="text-gray-500">
                    <span>Ongkir Dibayar Restoran: </span>
                    <strong className="text-gray-800">
                      Rp {ord.deliveryFee.toLocaleString("id-ID")}
                    </strong>
                  </div>
                  <div className="space-x-3">
                    <span className="text-gray-600">
                      Laba Hub:{" "}
                      <strong className="text-emerald-600 font-bold">
                        Rp {ord.orderProfit.toLocaleString("id-ID")}
                      </strong>
                    </span>
                    <span className="text-gray-900 font-bold text-sm">
                      Total: Rp {ord.finalAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Kirim Pesanan (Assign Driver / Kurir) */}
      {dispatchingOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md p-4 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">
                Kirim Pesanan #{dispatchingOrder.orderNumber}
              </h3>
              <button
                onClick={() => setDispatchingOrder(null)}
                className="text-gray-400 hover:text-gray-600 font-medium"
              >
                X
              </button>
            </div>

            <form onSubmit={handleSubmitDispatch} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nama Kurir / Pengantar
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Pak Joko"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    No. HP Kurir
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="081298765432"
                    value={courierPhone}
                    onChange={(e) => setCourierPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Plat Nomor Armada
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="B 4567 KAA"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Estimasi Sampai ke Restoran
                </label>
                <input
                  type="text"
                  required
                  placeholder="30 - 45 Menit"
                  value={estimatedArrival}
                  onChange={(e) => setEstimatedArrival(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setDispatchingOrder(null)}
                  className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                >
                  {isSubmittingDispatch ? "Memproses..." : "Berangkatkan Kurir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Surat Jalan Pengiriman */}
      {printOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-xl p-4 space-y-4 max-h-[95vh] overflow-y-auto print:p-0 print:border-0">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">SURAT JALAN PENGIRIMAN</h2>
                <p className="text-xs text-gray-500">Dokumen Pengantar Bahan Baku</p>
              </div>

              <div className="text-right">
                <p className="font-mono font-bold text-gray-900 text-sm">
                  #{printOrder.orderNumber}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(printOrder.createdAt).toLocaleDateString("id-ID")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-medium block text-xs">
                  Tujuan Pengiriman
                </span>
                <p className="font-medium text-gray-800 mt-1">{printOrder.buyer.name}</p>
                <p className="text-gray-600 text-xs">
                  {printOrder.deliveryAddress?.street}, {printOrder.deliveryAddress?.city}
                </p>
                <p className="text-gray-600 text-xs">
                  Telp: {printOrder.deliveryAddress?.phoneNumber}
                </p>
              </div>

              <div>
                <span className="text-gray-400 font-medium block text-xs">
                  Armada Kurir
                </span>
                <p className="font-medium text-gray-800 mt-1">{printOrder.courierName || "Internal"}</p>
                <p className="text-gray-600 text-xs">Plat: {printOrder.vehicleNumber || "-"}</p>
                <p className="text-gray-600 text-xs">Hp: {printOrder.courierPhone || "-"}</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-gray-200 text-gray-500 font-medium">
                  <tr>
                    <th className="p-2.5">Nama Bahan</th>
                    <th className="p-2.5 text-center">Jumlah Antar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {printOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 font-medium text-gray-800">{it.product.name}</td>
                      <td className="p-2.5 text-center font-medium">
                        {it.quantity} {it.product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 text-center text-xs pt-8 border-t">
              <div>
                <p className="text-gray-500 text-xs">Diserahkan oleh (Sopir Hub)</p>
                <div className="h-16" />
                <p className="font-medium text-gray-800">
                  ( {printOrder.courierName || "....................."} )
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Diterima oleh (Restoran)</p>
                <div className="h-16" />
                <p className="font-medium text-gray-800">( ..................... )</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t print:hidden">
              <button
                onClick={() => setPrintOrder(null)}
                className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-md"
              >
                Cetak Surat Jalan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
