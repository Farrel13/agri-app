"use client";

import { useState } from "react";
import { placeOrderAction, CartItemInput } from "./actions";

interface Product {
  id: string;
  name: string;
  stock: number;
  unit: string;
  priceHub: number | null;
  user?: { name: string | null } | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function RestoranClient({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pemesanan Bahan Baku Restoran</h1>
        <p className="text-gray-600">Pilih bahan segar dari Hub dan langsung buat pesanan.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Katalog Bahan Baku Tersedia</h2>

          {products.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-dashed text-center text-gray-500">
              Belum ada bahan baku yang tersedia di pasaran saat ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((item) => {
                const inCart = cart.find((c) => c.product.id === item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded">
                          Stok: {item.stock} {item.unit}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Petani: {item.user?.name || "Mitra Tani"}
                      </p>
                      <p className="text-emerald-600 font-bold text-lg mt-2">
                        Rp {(item.priceHub || 0).toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-normal text-gray-500">/ {item.unit}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(item)}
                      disabled={item.stock <= 0}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition ${
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
                );
              })}
            </div>
          )}
        </div>

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
                        className="text-red-500 hover:text-red-700 text-xs px-1"
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
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
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