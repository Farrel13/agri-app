"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { placeOrderAction, addRestaurantAddressAction } from "./actions";

interface Address {
  id: string;
  label: string;
  recipientName: string;
  phoneNumber: string;
  street: string;
  city: string;
  province: string;
  postalCode?: string | null;
  isPrimary: boolean;
}

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
  averageRating?: number | null;
  reviewCount?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface RestoranClientProps {
  products: Product[];
  userAddresses: Address[];
}

export default function RestoranClient({ products, userAddresses }: RestoranClientProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Alamat & Pembayaran
  const [addresses, setAddresses] = useState<Address[]>(userAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    userAddresses[0]?.id || ""
  );
  const [paymentMethod, setPaymentMethod] = useState<"QRIS" | "TRANSFER_BANK" | "E_WALLET">("QRIS");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Auto-dismiss feedback message
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 1. Muat Cart dari LocalStorage saat pertama render (Persisten)
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("agri_cart_restoran");
      if (savedCart) {
        const parsed: CartItem[] = JSON.parse(savedCart);
        // Validasi produk masih ada di katalog terbaru
        const validCart = parsed.filter((ci) =>
          products.some((p) => p.id === ci.product.id)
        );
        setCart(validCart);
      }
    } catch (e) {
      console.error("Gagal membaca cart dari localStorage", e);
    }
  }, [products]);

  // Simpan ke LocalStorage tiap ada perubahan cart
  const updateCartAndPersist = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem("agri_cart_restoran", JSON.stringify(newCart));
    } catch (e) {
      console.error("Gagal menyimpan cart", e);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const matchName = p.name.toLowerCase().includes(q);
    const matchStore = p.verifiedBy?.name ? p.verifiedBy.name.toLowerCase().includes(q) : false;
    const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
    const matchFarmer = p.user?.name ? p.user.name.toLowerCase().includes(q) : false;

    return matchName || matchStore || matchDesc || matchFarmer;
  });

  const isImageValid = (imageUrl?: string | null, imageExpiresAt?: Date | string | null) => {
    if (!imageUrl || !imageExpiresAt) return false;
    return new Date(imageExpiresAt).getTime() > Date.now();
  };

  const addToCart = (product: Product) => {
    setMessage(null);
    const existing = cart.find((item) => item.product.id === product.id);
    let nextCart: CartItem[];

    if (existing) {
      if (existing.quantity + 1 > product.stock) {
        setMessage({
          type: "error",
          text: `Jumlah melebihi stok yang tersedia (${product.stock} ${product.unit})`,
        });
        return;
      }
      nextCart = cart.map((item) =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      nextCart = [...cart, { product, quantity: 1 }];
    }
    updateCartAndPersist(nextCart);
  };

  const updateQuantity = (productId: string, newQty: number, maxStock: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    if (newQty > maxStock) {
      setMessage({
        type: "error",
        text: `Maksimal pemesanan sesuai stok yang tersedia: ${maxStock}`,
      });
      return;
    }
    const nextCart = cart.map((item) =>
      item.product.id === productId ? { ...item, quantity: newQty } : item
    );
    updateCartAndPersist(nextCart);
  };

  const removeFromCart = (productId: string) => {
    const nextCart = cart.filter((item) => item.product.id !== productId);
    updateCartAndPersist(nextCart);
  };

  // Pengelompokan cart berdasarkan Hub (Multi-Vendor breakdown)
  const cartByHub = cart.reduce((acc, item) => {
    const hubName = item.product.verifiedBy?.name || "Toko Hub Pusat";
    if (!acc[hubName]) acc[hubName] = [];
    acc[hubName].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const hubCount = Object.keys(cartByHub).length;
  const deliveryFeeTotal = hubCount * 15000;

  const subtotalAmount = cart.reduce((sum, item) => {
    const price = item.product.priceHub || 0;
    return sum + price * item.quantity;
  }, 0);

  const grandTotal = subtotalAmount + deliveryFeeTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    setMessage(null);

    const res = await placeOrderAction({
      items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      addressId: selectedAddressId,
      paymentMethod: paymentMethod,
    });

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: res.message });
      updateCartAndPersist([]); // Bersihkan keranjang
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const handleCreateAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingAddress(true);
    const formData = new FormData(e.currentTarget);
    const res = await addRestaurantAddressAction(formData);
    setSavingAddress(false);

    if (res.success && res.address) {
      setAddresses((prev) => [...prev, res.address!]);
      setSelectedAddressId(res.address.id);
      setShowAddressModal(false);
      setMessage({ type: "success", text: "Alamat pengiriman berhasil ditambahkan." });
    } else {
      setMessage({ type: "error", text: res.message || "Gagal menyimpan alamat." });
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Katalog Bahan Baku Restoran
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pesan komoditas pangan segar yang telah lolos verifikasi mutu Toko Hub.
          </p>
        </div>

        <Link
          href="/restoran/pesanan"
          className="inline-flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 font-medium px-4 py-2 rounded-md border border-gray-200 transition text-sm"
        >
          Riwayat dan Pembayaran Pesanan
        </Link>
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
          <div className="flex items-center gap-2 shrink-0">
            {message.type === "success" && (
              <Link
                href="/restoran/pesanan"
                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
              >
                Bayar Sekarang
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-gray-400 hover:text-gray-600 p-1 text-xs"
              title="Tutup pesan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Products + Sticky Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Katalog Produk (2 Kolom) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari nama bahan pangan, toko hub, atau petani..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md py-2.5 pl-3 pr-8 text-sm outline-none focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white p-6 text-center rounded-md border border-gray-200">
              <p className="font-medium text-gray-700 text-sm">Bahan tidak ditemukan</p>
              <p className="text-xs text-gray-400 mt-1">Coba kata kunci pencarian lainnya.</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                >
                  Bersihkan pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const imgValid = isImageValid(p.imageUrl, p.imageExpiresAt);
                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 bg-gray-100 overflow-hidden">
                        {imgValid && p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                            <span>{p.imageUrl ? "Foto Expired (>24 Jam)" : "Foto Segar Hub"}</span>
                          </div>
                        )}

                        {/* Nama Toko Hub */}
                        {p.verifiedBy?.name && (
                          <div className="absolute top-2 left-2 bg-gray-900/70 text-white text-xs font-medium px-2 py-0.5 rounded">
                            {p.verifiedBy.name}
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                          <span className="font-medium text-emerald-700 text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">
                            Rp {(p.priceHub || 0).toLocaleString("id-ID")}/{p.unit}
                          </span>
                        </div>

                        {/* Rating Bintang */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="text-amber-500">★</span>
                          <span className="text-gray-800">
                            {p.averageRating ? p.averageRating.toFixed(1) : "Baru"}
                          </span>
                          <span className="text-gray-400 text-xs">
                            ({p.reviewCount || 0} ulasan)
                          </span>
                        </div>

                        {p.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                        )}

                        <div className="text-xs text-gray-500 flex justify-between pt-1">
                          <span>
                            Petani: <strong>{p.user?.name || "Mitra Tani"}</strong>
                          </span>
                          <span>
                            Stok: <strong>{p.stock} {p.unit}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        onClick={() => addToCart(p)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        + Tambah ke Keranjang
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Keranjang Belanja (Sticky) */}
        <div className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="bg-white p-4 rounded-md border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="font-bold text-gray-900 text-sm">
                Keranjang Restoran
              </h2>
              <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {cart.length} Item
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="py-4 text-center text-gray-400 text-xs">
                Keranjang masih kosong. Pilih bahan segar dari katalog.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Rincian Pesanan per Toko Hub (Multi-Vendor Split Info) */}
                {hubCount > 1 && (
                  <div className="bg-white border border-gray-300 p-2.5 rounded-md text-xs text-gray-700">
                    <strong>Split Order Otomatis:</strong> Bahan Anda berasal dari <strong>{hubCount} Toko Hub</strong> berbeda. Sistem akan memecah pesanan secara mandiri.
                  </div>
                )}

                {Object.entries(cartByHub).map(([hubName, items]) => (
                  <div key={hubName} className="border border-gray-200 rounded-md p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                      <span>Toko: {hubName}</span>
                      <span className="text-xs text-gray-400">Ongkir: Rp 15.000</span>
                    </div>

                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.product.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-200">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-gray-800 truncate">{item.product.name}</p>
                            <p className="text-xs text-emerald-700 font-medium">
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
                              className="w-14 border border-gray-300 rounded-md px-1.5 py-1 text-center text-xs font-medium outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-rose-500 hover:text-rose-700 text-xs px-1 font-medium"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Pilih Alamat Pengiriman */}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Alamat Pengiriman</label>
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(true)}
                      className="text-xs text-emerald-700 hover:underline font-medium"
                    >
                      + Tambah Alamat
                    </button>
                  </div>

                  {addresses.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(true)}
                      className="w-full text-xs text-center p-2.5 border border-dashed border-gray-300 rounded-md text-emerald-700 bg-white font-medium"
                    >
                      + Tambah Alamat Pengantaran
                    </button>
                  ) : (
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full border border-gray-300 rounded-md p-2 text-xs bg-white text-gray-800 font-medium outline-none focus:border-emerald-500"
                    >
                      {addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} - {a.street}, {a.city}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Pilih Metode Pembayaran */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Metode Pembayaran</label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(["QRIS", "TRANSFER_BANK", "E_WALLET"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-md font-medium border transition text-center ${
                          paymentMethod === m
                            ? "bg-white border-emerald-600 text-emerald-800"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {m === "QRIS" ? "QRIS" : m === "TRANSFER_BANK" ? "Transfer" : "E-Wallet"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ringkasan Biaya */}
                <div className="pt-2 border-t space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal Bahan:</span>
                    <span className="font-medium">Rp {subtotalAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ongkos Kirim ({hubCount} Hub):</span>
                    <span className="font-medium">Rp {deliveryFeeTotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 text-sm pt-2 border-t">
                    <span>Total Pembayaran:</span>
                    <span className="text-emerald-700">Rp {grandTotal.toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium text-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Membuat Pesanan..." : "Pesan dan Lanjut Pembayaran"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Tambah Alamat Baru */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md p-4 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Tambah Alamat Dapur / Cabang</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Label Alamat</label>
                <input
                  type="text"
                  name="label"
                  required
                  placeholder="cth: Dapur Cabang Kemang"
                  className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nama Penerima</label>
                  <input
                    type="text"
                    name="recipientName"
                    required
                    placeholder="Chef / Manager"
                    className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">No. WhatsApp</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    required
                    placeholder="08123456789"
                    className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alamat Jalan dan No</label>
                <input
                  type="text"
                  name="street"
                  required
                  placeholder="Jl. Raya Kemang No. 18"
                  className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kota / Kab</label>
                  <input
                    type="text"
                    name="city"
                    required
                    placeholder="Jakarta Selatan"
                    className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Provinsi</label>
                  <input
                    type="text"
                    name="province"
                    required
                    defaultValue="DKI Jakarta"
                    className="w-full border border-gray-300 rounded-md p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50 transition"
                >
                  {savingAddress ? "Menyimpan..." : "Simpan Alamat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
