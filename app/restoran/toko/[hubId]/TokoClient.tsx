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

  // Filter pencarian di halaman toko khusus: cari nama bahan, deskripsi, atau nama petani
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

    const res = await placeOrderAction(orderPayload);

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setCart([]);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Halaman Toko Pedagang */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-6 sm:p-8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
            🏪
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-blue-200">
              Toko Pedagang Resmi (Hub)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{hubUser.name}</h1>
            <p className="text-xs text-blue-100 mt-0.5">
              Menyediakan {products.length} bahan baku segar terverifikasi untuk restoran.
            </p>
          </div>
        </div>

        <Link
          href="/restoran"
          className="bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/20 transition cursor-pointer backdrop-blur-sm self-start md:self-center"
        >
          ← Kembali ke Semua Katalog
        </Link>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Kolom Pencarian Bahan Baku di Toko Ini */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari bahan di Toko ${hubUser.name} (nama bahan, deskripsi, asal petani)...`}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
            Hasil: <strong>{filteredProducts.length}</strong> bahan ditemukan
          </div>
        )}
      </div>

      {/* Grid Katalog & Keranjang Toko */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">
              Katalog Produk Toko {hubUser.name}
            </h2>
            <span className="text-xs text-gray-500">{filteredProducts.length} bahan</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed text-center text-gray-500 space-y-3">
              <span className="text-4xl block">📦</span>
              <h3 className="font-bold text-gray-800 text-base">Bahan Baku Tidak Ditemukan</h3>
              <p className="text-gray-500 text-xs max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada bahan di toko ini yang cocok dengan "${searchQuery}".`
                  : "Toko ini belum memiliki bahan baku yang siap dijual saat ini."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-3.5 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map((item) => {
                const inCart = cart.find((c) => c.product.id === item.id);
                const validImage = isImageValid(item.imageUrl, item.imageExpiresAt);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition"
                  >
                    {/* Foto Panen */}
                    <div className="h-44 w-full bg-gray-100 relative">
                      {validImage ? (
                        <>
                          <img
                            src={item.imageUrl!}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm shadow flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse"></span>
                            Live Update Panen (&lt;24 Jam)
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50">
                          <span className="text-2xl mb-1">📷</span>
                          <span>Foto panen telah kadaluarsa / terhapus</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded shrink-0">
                            Stok: {item.stock} {item.unit}
                          </span>
                        </div>

                        {/* Deskripsi Produk */}
                        {item.description ? (
                          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                            <span className="font-semibold text-gray-700">Deskripsi:</span>{" "}
                            {item.description}
                          </div>
                        ) : null}

                        <div className="pt-2 border-t text-xs space-y-1">
                          <div className="text-gray-600">
                            🌱 Asal Petani:{" "}
                            <strong className="text-emerald-700">
                              {item.user?.name || "Mitra Petani"}
                            </strong>
                          </div>
                        </div>

                        <p className="text-emerald-600 font-bold text-lg pt-1">
                          Rp {(item.priceHub || 0).toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-gray-500">/ {item.unit}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        disabled={item.stock <= 0}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition cursor-pointer mt-3 ${
                          item.stock <= 0
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : inCart
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {item.stock <= 0
                          ? "Stok Habis"
                          : inCart
                          ? `Tambah Lagi (${inCart.quantity})`
                          : "+ Tambah ke Keranjang"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Keranjang Belanja */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-fit space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3 flex justify-between items-center">
            <span>🛒 Keranjang Belanja</span>
            <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} Item
            </span>
          </h2>

          {cart.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6 italic">
              Keranjang masih kosong.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="py-3 flex justify-between items-center gap-2"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-800">{item.product.name}</p>
                      <p className="text-[11px] text-gray-500">
                        Dari: {item.product.user?.name || "Petani"}
                      </p>
                      <p className="text-xs text-emerald-600 font-semibold">
                        Rp {((item.product.priceHub || 0) * item.quantity).toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
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
                        className="w-16 border rounded px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-500 hover:text-red-700 text-xs px-1 cursor-pointer"
                        title="Hapus"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between font-bold text-gray-900 text-base">
                  <span>Total Harga:</span>
                  <span className="text-emerald-600">
                    Rp {totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Memproses Pesanan..." : "Pesan Sekarang"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
