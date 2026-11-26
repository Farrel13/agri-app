"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
        queueMicrotask(() => {
          setCart(validCart);
        });
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

  const isImageValid = (imageUrl?: string | null) => {
    return Boolean(imageUrl);
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
  const cartByHub = Object.groupBy(
    cart,
    (item) => item.product.verifiedBy?.name || "Toko Hub Pusat"
  );

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
      setMessage({ type: "success", text: res.message || "Pesanan berhasil dibuat!" });
      updateCartAndPersist([]); // Bersihkan keranjang
    } else {
      setMessage({ type: "error", text: res.message || "Gagal membuat pesanan." });
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
          <div className="flex items-center gap-2 shrink-0">
            {message.type === "success" && (
              <Link
                href="/restoran/pesanan"
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition"
              >
                Bayar Sekarang
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="opacity-80 hover:opacity-100 text-sm font-bold"
              title="Tutup pesan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header Halaman */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Katalog Bahan Baku</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Produk pangan segar terverifikasi dari Toko Hub mitra.
            </p>
          </div>
          <Link
            href="/restoran/pesanan"
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
          >
            {/* Ikon resi pesanan */}
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Riwayat Pesanan
          </Link>
        </div>

        {/* Konten Utama: 2 Kolom (Katalog Kiri ~70%, Keranjang Kanan ~30%) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Kolom Kiri: Pencarian + Grid Produk (~70%) */}
          <div className="w-full lg:w-[70%] min-w-0">
            {/* Search Bar */}
            <div className="relative mb-4">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
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
                placeholder="Cari nama bahan, toko hub, atau petani..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Grid Produk */}
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 p-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-800">Bahan tidak ditemukan</p>
                <p className="text-gray-400 text-xs mt-1">Coba gunakan kata kunci lain atau periksa filter</p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((p) => {
                  const imgValid = isImageValid(p.imageUrl);
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      {/* Zona Gambar */}
                      <div className="h-44 relative bg-gray-100 overflow-hidden">
                        {imgValid && p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-50/50 to-gray-50 text-gray-400">
                            <span className="text-2xl">🌱</span>
                            <span className="text-[11px] font-medium text-gray-500">Belum ada foto</span>
                          </div>
                        )}

                        {/* Badge foto segar (overlay kiri atas) */}
                        {imgValid && (
                          <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-full font-medium z-10">
                            Foto Segar
                          </span>
                        )}

                        {/* Badge lokasi Hub (overlay kanan atas) */}
                        <span className="absolute top-2.5 right-2.5 bg-emerald-800/90 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-2xs z-10">
                          {p.verifiedBy?.name ? `Sentra Hub ${p.verifiedBy.name}` : "Mitra Hub Mitra"}
                        </span>
                      </div>

                      {/* Body Kartu */}
                      <div className="p-4 flex flex-col flex-1 justify-between space-y-2">
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">
                            {p.name}
                          </h3>

                          {/* Baris Rating & Ulasan */}
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-amber-500 text-xs">★</span>
                            <span className="text-xs font-semibold text-gray-800">
                              {p.averageRating ? p.averageRating.toFixed(1) : "Baru"}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              ({p.reviewCount || 0} ulasan)
                            </span>
                          </div>

                          {/* Baris Harga Tebal & Hijau Tua */}
                          <div className="mt-2.5 flex items-baseline gap-1">
                            <span className="text-lg font-extrabold text-emerald-800">
                              Rp {(p.priceHub || 0).toLocaleString("id-ID")}
                            </span>
                            <span className="text-xs font-medium text-gray-500">/ {p.unit}</span>
                          </div>

                          {/* Meta: Nama Petani & Sisa Stok */}
                          <div className="mt-1.5 flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-2">
                            <span className="truncate max-w-[130px]" title={p.user?.name || "Petani"}>
                              Petani: <strong className="text-gray-700">{p.user?.name || "Petani"}</strong>
                            </span>
                            <span className="shrink-0 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                              Stok: {p.stock} {p.unit}
                            </span>
                          </div>

                          {/* Deskripsi Singkat */}
                          {p.description && (
                            <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                              {p.description}
                            </p>
                          )}
                        </div>

                        {/* Tombol Penuh: + Tambah ke Keranjang (Hijau Daun Tua) */}
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          className="w-full py-2.5 rounded-xl text-xs font-bold transition bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer shadow-xs active:scale-[0.99] mt-3"
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

          {/* Kolom Kanan: Panel Keranjang (~30%, sticky di lg) */}
          <div className="w-full lg:w-[30%] shrink-0 sticky top-20">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              {/* Header Keranjang */}
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🛒</span>
                  <span className="font-bold text-gray-900 text-sm">Keranjang Pesanan</span>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {cart.length} item
                </span>
              </div>

              {/* Keranjang Kosong */}
              {cart.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400 text-lg">
                    🧺
                  </div>
                  <p className="text-xs font-semibold text-gray-700">Belum ada item di keranjang</p>
                  <p className="text-[11px] text-gray-400 max-w-[200px] mx-auto">
                    Pilih bahan pangan segar di katalog sebelah kiri untuk mulai memesan.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Info Split Multi-Hub */}
                  {hubCount > 1 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-700">
                      <strong>Split Order Otomatis:</strong> Bahan berasal dari{" "}
                      <strong>{hubCount} Toko Hub</strong> berbeda. Pesanan akan dipisah otomatis.
                    </div>
                  )}

                  {/* Item Keranjang per Hub */}
                  {Object.entries(cartByHub).map(([hubName, items]) => (
                    <div key={hubName}>
                      <p className="text-xs text-gray-500 font-medium mb-2">
                        Toko: {hubName}
                      </p>
                      {(items ?? []).map((item) => (
                        <div
                          key={item.product.id}
                          className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
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
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Info Ongkir */}
                  <p className="text-xs text-gray-400">Ongkir: Rp 15.000 / Hub</p>

                  {/* Pilih Alamat Pengiriman */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700">
                        Alamat Pengiriman
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddressModal(true)}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        + Tambah Alamat
                      </button>
                    </div>
                    {addresses.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowAddressModal(true)}
                        className="w-full text-xs text-center p-2.5 border border-dashed border-gray-300 rounded-xl text-emerald-600 bg-white font-medium hover:bg-emerald-50 transition"
                      >
                        + Tambah Alamat
                      </button>
                    ) : (
                      <select
                        value={selectedAddressId}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2 text-xs bg-white focus:outline-none focus:border-emerald-400"
                      >
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label} - {a.street}, {a.city}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Metode Pembayaran */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Metode Pembayaran
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["QRIS", "TRANSFER_BANK", "E_WALLET"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`py-2 rounded-xl text-xs font-semibold transition text-center ${
                            paymentMethod === m
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {m === "QRIS" ? "QRIS" : m === "TRANSFER_BANK" ? "Transfer" : "E-Wallet"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ringkasan Biaya */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>Rp {subtotalAmount.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Ongkir ({hubCount} Hub)</span>
                      <span>Rp {deliveryFeeTotal.toLocaleString("id-ID")}</span>
                    </div>
                    <hr className="border-gray-100 my-1" />
                    <div className="flex justify-between font-bold text-base">
                      <span className="text-gray-900">Total</span>
                      <span className="text-emerald-600">
                        Rp {grandTotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Checkout */}
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Membuat Pesanan..." : "Pesan dan Lanjut Pembayaran"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tambah Alamat Baru */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4">
            {/* Header Modal */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Tambah Alamat Dapur / Cabang</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="space-y-3">
              {/* Label Alamat */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Label Alamat</label>
                <input
                  type="text"
                  name="label"
                  required
                  placeholder="cth: Dapur Cabang Kemang"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-400"
                />
              </div>

              {/* Nama Penerima & No. WhatsApp */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nama Penerima</label>
                  <input
                    type="text"
                    name="recipientName"
                    required
                    placeholder="Chef / Manager"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">No. WhatsApp</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    required
                    placeholder="08123456789"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Alamat Jalan */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alamat Jalan dan No</label>
                <input
                  type="text"
                  name="street"
                  required
                  placeholder="Jl. Raya Kemang No. 18"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-400"
                />
              </div>

              {/* Kota & Provinsi */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kota / Kab</label>
                  <input
                    type="text"
                    name="city"
                    required
                    placeholder="Jakarta Selatan"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Provinsi</label>
                  <input
                    type="text"
                    name="province"
                    required
                    defaultValue="DKI Jakarta"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition"
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
