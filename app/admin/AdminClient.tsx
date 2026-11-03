"use client";

import { useState, useEffect } from "react";
import { changeUserRoleAction, deleteUserAction } from "./actions";
import { Role } from "@prisma/client";
import ConfirmDialog from "@/components/ConfirmDialog";

interface UserItem {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  role: Role;
  createdAt: Date | string;
  _count: {
    products: number;
    ordersAsBuyer: number;
    ordersAsHub: number;
  };
}

interface OrderItem {
  id: string;
  orderNumber: string;
  status: string;
  finalAmount: number;
  createdAt: Date | string;
  buyer: { id: string; name: string };
  hub: { id: string; name: string };
  payment?: { method: string; status: string } | null;
}

interface AdminClientProps {
  users: UserItem[];
  orders: OrderItem[];
  stats: {
    totalUsers: number;
    petaniCount: number;
    hubCount: number;
    restaurantCount: number;
    totalOrders: number;
    totalGMV: number;
  };
}

export default function AdminClient({ users, orders, stats }: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"USERS" | "ORDERS">("USERS");
  const [userList, setUserList] = useState<UserItem[]>(users);
  const [searchUser, setSearchUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const filteredUsers = userList.filter((u) => {
    const q = searchUser.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setLoading(true);
    setMsg(null);
    const res = await changeUserRoleAction(userId, newRole);
    setLoading(false);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setUserList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setLoading(true);
    setMsg(null);
    const res = await deleteUserAction(userId);
    setLoading(false);
    setDeleteTarget(null);

    if (res.success) {
      setMsg({ text: res.message, success: true });
      setUserList((prev) => prev.filter((u) => u.id !== userId));
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola pengguna, role, dan pantau transaksi platform.
        </p>
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

      {/* Statistik Platform */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Total Pengguna
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
        </div>
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Petani Terdaftar
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.petaniCount}</p>
        </div>
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Toko Hub Aktif
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.hubCount}</p>
        </div>
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">
            Restoran Mitra
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.restaurantCount}</p>
        </div>
        <div className="bg-white p-4 rounded-md border border-gray-200 border-l-4 border-l-emerald-500 col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-gray-500 block">
            Perputaran Dana (GMV)
          </span>
          <p className="text-lg font-bold text-emerald-600 mt-1">
            Rp {stats.totalGMV.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("USERS")}
          className={`py-2.5 px-4 font-medium text-xs border-b-2 transition ${
            activeTab === "USERS"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Manajemen Pengguna ({userList.length})
        </button>
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`py-2.5 px-4 font-medium text-xs border-b-2 transition ${
            activeTab === "ORDERS"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Pengawasan Transaksi ({orders.length})
        </button>
      </div>

      {activeTab === "USERS" ? (
        <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
          <div className="flex justify-between items-center gap-4">
            <input
              type="text"
              placeholder="Cari user (nama, username, email)..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-xs outline-none focus:border-emerald-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500 border-b border-gray-200 text-xs font-medium">
                <tr>
                  <th className="p-3">Nama Lengkap</th>
                  <th className="p-3">Username / Email</th>
                  <th className="p-3">Role Saat Ini</th>
                  <th className="p-3 text-center">Aktivitas</th>
                  <th className="p-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-medium text-gray-800">{u.name}</td>
                    <td className="p-3 text-gray-500">
                      <div>@{u.username}</div>
                      <div className="text-xs text-gray-400">{u.email || "-"}</div>
                    </td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        disabled={loading}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        className="text-xs font-medium rounded-md px-2 py-1 border border-gray-300 outline-none bg-white text-gray-700 focus:border-emerald-500"
                      >
                        <option value="PETANI">PETANI</option>
                        <option value="HUB">HUB</option>
                        <option value="RESTAURANT">RESTAURANT</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="p-3 text-center text-xs text-gray-500">
                      {u.role === "PETANI" && `${u._count.products} Panen`}
                      {u.role === "HUB" && `${u._count.ordersAsHub} Pesanan Masuk`}
                      {u.role === "RESTAURANT" && `${u._count.ordersAsBuyer} Pesanan Dibuat`}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setDeleteTarget({ id: u.id, name: u.name })}
                        disabled={loading}
                        className="text-rose-600 hover:text-rose-700 font-medium text-xs border border-rose-200 hover:bg-rose-50 px-2.5 py-1 rounded-md transition bg-white cursor-pointer"
                      >
                        Hapus Akun
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-200 p-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500 border-b border-gray-200 text-xs font-medium">
              <tr>
                <th className="p-3">No. Pesanan</th>
                <th className="p-3">Pembeli (Resto)</th>
                <th className="p-3">Pemasok (Hub)</th>
                <th className="p-3">Metode Bayar</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Nilai Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-mono font-medium text-gray-900">#{ord.orderNumber}</td>
                  <td className="p-3 font-medium text-gray-800">{ord.buyer.name}</td>
                  <td className="p-3 font-medium text-gray-800">{ord.hub.name}</td>
                  <td className="p-3 text-gray-500 font-mono">
                    {ord.payment?.method || "-"} ({ord.payment?.status || "PENDING"})
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {ord.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-gray-900">
                    Rp {ord.finalAmount.toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog Konfirmasi Hapus User */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Hapus Akun Pengguna?"
        description={`Akun "${deleteTarget?.name}" beserta seluruh data terkait akan dihapus secara permanen dari sistem.`}
        confirmText="Hapus Akun"
        cancelText="Batal"
        isDanger
        isLoading={loading}
        onConfirm={() => {
          if (deleteTarget) handleDeleteUser(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
