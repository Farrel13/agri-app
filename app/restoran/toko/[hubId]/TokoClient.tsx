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
      setMessage({ type: "success", text: res.message });
      setCart([]);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      {/* Header Halaman Toko Hub */}
      <div className="bg-white border border-gray-200 rounded-md p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <span className="text-xs text-gray-500 font-medium">Toko Hub Terverifikasi</span>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{hubUser.name}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Menyediakan {products.length} bahan baku segar terverifikasi untuk restoran mitra.
          </p>
        </div>

        <Link
          href="/restoran"
          className="bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium px-3.5 py-2 rounded-md border border-gray-300 transition cursor-pointer self-start md:self-center"
        >
          Kembali ke Katalog
        </Link>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-xs font-medium border ${
            message.type === "success"
              ? "bg-white text-emerald-800 border-emerald-300"
              : "bg-white text-red-800 border-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Kolom Pencarian */}
      <div className="bg-white p-3 rounded-md border border-gray-200 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari bahan di Toko ${hubUser.name}...`}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="text-xs text-gray-500 whitespace-nowrap">
            {filteredProducts.length} bahan ditemukan
          </div>
        )}
      </div>

      {/* Grid Katalog & Keranjang Toko */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-900">
              Katalog Produk Toko {hubUser.name}
            </h2>
            <span className="text-xs text-gray-500">{filteredProducts.length} bahan</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white p-8 rounded-md border border-dashed border-gray-200 text-center text-gray-500 space-y-2">
              <h3 className="font-medium text-gray-800 text-sm">Bahan Baku Tidak Ditemukan</h3>
              <p className="text-gray-500 text-xs max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada bahan di toko ini yang cocok dengan "${searchQuery}".`
                  : "Toko ini belum memiliki bahan baku yang siap dijual saat ini."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((item) => {
                const inCart = cart.find((c) => c.product.id === item.id);
                const validImage = isImageValid(item.imageUrl, item.imageExpiresAt);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col justify-between"
                  >
                    {/* Foto Panen */}
                    <div className="h-40 w-full bg-gray-100 relative">
                      {validImage ? (
                        <>
                          <img
                            src={item.imageUrl!}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-gray-900/70 text-white text-[10px] font-medium px-2 py-0.5 rounded">
                            Update &lt;24 Jam
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50">
                          <span>Foto kadaluarsa</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-gray-900 text-sm">{item.name}</h3>
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded shrink-0">
                            Stok: {item.stock} {item.unit}
                          </span>
                        </div>

                        {item.description ? (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {item.description}
                          </p>
                        ) : null}

                        <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                          <div className="text-gray-500">
                            Petani:{" "}
                            <span className="text-gray-800 font-medium">
                              {item.user?.name || "Mitra Petani"}
                            </span>
                          </div>
                        </div>

                        <p className="text-emerald-600 font-bold text-base pt-1">
                          Rp {(item.priceHub || 0).toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-gray-500">/ {item.unit}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        disabled={item.stock <= 0}
                        className={`w-full py-2 rounded-md text-xs font-medium transition cursor-pointer mt-2 ${
                          item.stock <= 0
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : inCart
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
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
        <div className="bg-white border border-gray-200 rounded-md p-4 h-fit space-y-4">
          <div className="border-b border-gray-200 pb-3 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-900">Keranjang Belanja</h2>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} Item
            </span>
          </div>

          {cart.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-6">
              Keranjang masih kosong.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="py-2.5 flex justify-between items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {item.product.user?.name || "Petani"}
                      </p>
                      <p className="text-xs text-emerald-600 font-medium">
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
                        className="w-14 border border-gray-300 rounded px-2 py-1 text-center text-xs outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-gray-400 hover:text-rose-600 text-xs px-1 cursor-pointer"
                        title="Hapus"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-3">
                <div className="flex justify-between font-bold text-gray-900 text-sm">
                  <span>Total Harga:</span>
                  <span className="text-emerald-600">
                    Rp {totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Memproses..." : "Pesan Sekarang"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
