"use client";

import { useState } from "react";
import Link from "next/link";
import { placeOrderAction, CartItemInput } from "../../actions";

interface Product {
  id: string;
  name: string;
  description?: string | null;
  stock: number;
  unit: string;
  priceHub: number | null;
  imageUrl?: string | null;
  imageExpiresAt?: Date | string | null;
  user?: { id: string; name: string | null } | null;
  verifiedBy?: { id: string; name: string | null } | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface TokoClientProps {
  hubUser: { id: string; name: string; username: string };
  products: Product[];
}

export default function TokoClient({ hubUser, products }: TokoClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isImageValid = (imageUrl?: string | null, imageExpiresAt?: Date | string | null) => {
    if (!imageUrl || !imageExpiresAt) return false;
    return new Date(imageExpiresAt).getTime() > Date.now();
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.user?.name && p.user.name.toLowerCase().includes(q))
    );
  });

  const addToCart = (product: Product) => {
    setMessage(null);
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stock) {
          alert(`Jumlah melebihi stok yang tersedia (${product.stock} ${product.unit})`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, newQty: number, maxStock: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    if (newQty > maxStock) {
      alert(`Maksimal pemesanan sesuai stok: ${maxStock}`);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => {
    const price = item.product.priceHub || 0;
    return sum + price * item.quantity;
  }, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    setMessage(null);

    const orderPayload: CartItemInput[] = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    const res = await placeOrderAction({ items: orderPayload });

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "Pesanan berhasil dibuat!" });
      setCart([]);
    } else {
      setMessage({ type: "error", text: res.message || "Gagal membuat pesanan." });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast / Feedback Notifikasi */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl shadow-lg px-4 py-3 text-sm font-medium flex items-center gap-3 min-w-64 ${
            message.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <span className="flex-1">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="opacity-80 hover:opacity-100 text-sm font-bold"
            title="Tutup pesan"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Hero Toko Hub */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center gap-4">
          {/* Info Toko */}
          <div>
            <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">
              Toko Hub Terverifikasi
            </span>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{hubUser.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {products.length} produk segar tersedia
            </p>
            <span className="inline-flex mt-2 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 font-medium">
              ✅ Dikurasi Hub
            </span>
          </div>

          {/* Tombol Kembali */}
          <Link
            href="/restoran"
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shrink-0"
          >
            ← Kembali ke Katalog
          </Link>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">
          {/* Kolom Kiri: Pencarian + Grid Produk */}
          <div className="flex-1 min-w-0">
            {/* Search Bar */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari bahan di Toko ${hubUser.name}...`}
                className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Grid Produk */}
            {filteredProducts.length === 0 ? (
              <div className="mt-4 py-16 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-semibold text-gray-700">Bahan tidak ditemukan</p>
                <p className="text-gray-400 text-sm mt-1">
                  {searchQuery
                    ? `Tidak ada bahan yang cocok dengan "${searchQuery}".`
                    : "Toko ini belum memiliki bahan baku yang siap dijual saat ini."}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((item) => {
                  const inCart = cart.find((c) => c.product.id === item.id);
                  const validImage = isImageValid(item.imageUrl, item.imageExpiresAt);

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                    >
                      {/* Zona Gambar */}
                      <div className="h-48 relative bg-gray-100">
                        {validImage && item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <span className="text-3xl">🌿</span>
                            <span className="text-gray-400 text-xs">Foto segera hadir</span>
                          </div>
                        )}

                        {/* Badge foto segar */}
                        {validImage && (
                          <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
                            📸 Foto Segar
                          </span>
                        )}

                        {/* Badge stok kanan atas */}
                        <span className="absolute top-2 right-2 bg-gray-900/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                          Stok: {item.stock} {item.unit}
                        </span>
                      </div>

                      {/* Body Kartu */}
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                          {item.name}
                        </h3>

                        {/* Petani */}
                        <p className="text-xs text-gray-400 mt-1">
                          🌾 {item.user?.name || "Mitra Petani"}
                        </p>

                        {/* Deskripsi */}
                        {item.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}

                        {/* Harga */}
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-lg font-bold text-emerald-600">
                            Rp {(item.priceHub || 0).toLocaleString("id-ID")}
                          </span>
                          <span className="text-xs text-gray-400">/ {item.unit}</span>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Tombol Tambah ke Keranjang */}
                        {item.stock <= 0 ? (
                          <button
                            disabled
                            className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
                          >
                            Stok Habis
                          </button>
                        ) : inCart ? (
                          <button
                            onClick={() => addToCart(item)}
                            className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                          >
                            ✓ Di Keranjang ({inCart.quantity})
                          </button>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            + Tambah ke Keranjang
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kolom Kanan: Keranjang (sticky, hanya tampil di lg ke atas) */}
          <div className="w-80 shrink-0 sticky top-20 hidden lg:block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              {/* Header Keranjang */}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">🛒 Keranjang</span>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)} item
                </span>
              </div>

              {/* Keranjang Kosong */}
              {cart.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Belum ada item di keranjang.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Daftar Item */}
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex justify-between items-center py-2"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-emerald-600 font-semibold">
                            Rp {((item.product.priceHub || 0) * item.quantity).toLocaleString("id-ID")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.product.id,
                                Number(e.target.value),
                                item.product.stock
                              )
                            }
                            className="w-12 text-center text-xs border border-gray-200 rounded-lg p-1 focus:outline-none focus:border-emerald-400"
                          />
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold px-1"
                            title="Hapus"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ringkasan Total */}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between font-bold text-base">
                      <span className="text-gray-900">Total</span>
                      <span className="text-emerald-600">
                        Rp {totalAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Pesan */}
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Memproses..." : "Pesan Sekarang"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
