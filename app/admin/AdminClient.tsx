"use client";

import { useState, useEffect, useTransition } from "react";
import {
  changeUserRoleAction,
  deleteUserAction,
  getLogsAction,
  getServerMetricsAction,
  clearOldLogsAction,
  triggerManualCronCleanupAction,
  simulateWafAttackAction,
} from "./actions";
import { Role, LogSeverity } from "@prisma/client";
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

export interface SerializedSystemLog {
  id: string;
  type: "WAF" | "SERVER" | "SECURITY" | "AUTH";
  severity: LogSeverity;
  action: string;
  message: string;
  endpoint?: string | null;
  method?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface ServerMetricsData {
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
    platform: string;
    memory: {
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
    };
  };
  database: {
    status: string;
    latencyMs: number;
    provider: string;
  };
  rateLimiter: {
    backend: string;
    status: string;
  };
  stats: {
    totalWafLogs: number;
    totalServerLogs: number;
    criticalAlerts: number;
    recentWafThreats24h: number;
  };
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
  initialWafLogs: SerializedSystemLog[];
  initialServerLogs: SerializedSystemLog[];
  initialMetrics: ServerMetricsData;
}

export default function AdminClient({
  users,
  orders,
  stats,
  initialWafLogs,
  initialServerLogs,
  initialMetrics,
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"USERS" | "ORDERS" | "WAF" | "SERVER">("USERS");
  const [userList, setUserList] = useState<UserItem[]>(users);
  const [searchUser, setSearchUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // WAF Logs State
  const [wafLogs, setWafLogs] = useState<SerializedSystemLog[]>(initialWafLogs);
  const [wafSeverityFilter, setWafSeverityFilter] = useState<string>("ALL");
  const [wafSearch, setWafSearch] = useState<string>("");
  const [selectedMetaLog, setSelectedMetaLog] = useState<SerializedSystemLog | null>(null);

  // Server Logs & Metrics State
  const [serverLogs, setServerLogs] = useState<SerializedSystemLog[]>(initialServerLogs);
  const [serverSearch, setServerSearch] = useState<string>("");
  const [metrics, setMetrics] = useState<ServerMetricsData>(initialMetrics);

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  // Format Helper Waktu Indonesia (WIB)
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}h ${hours}j ${minutes}m`;
    if (hours > 0) return `${hours}j ${minutes}m ${secs}d`;
    return `${minutes}m ${secs}d`;
  };

  const getSeverityBadge = (severity: LogSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-800 border-rose-300 font-bold";
      case "ALERT":
        return "bg-amber-100 text-amber-800 border-amber-300 font-bold";
      case "WARN":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "INFO":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  // Refresh WAF Logs
  const fetchWafLogs = async (severity = wafSeverityFilter, search = wafSearch) => {
    setLoading(true);
    const res = await getLogsAction({
      type: "WAF",
      severity: severity === "ALL" ? undefined : (severity as LogSeverity),
      search: search || undefined,
      limit: 50,
    });
    setLoading(false);
    if (res.success && res.logs) {
      setWafLogs(res.logs as SerializedSystemLog[]);
    }
  };

  // Refresh Server Logs & Metrics
  const fetchServerLogsAndMetrics = async (search = serverSearch) => {
    setLoading(true);
    const [logsRes, metricsRes] = await Promise.all([
      getLogsAction({
        type: "ALL",
        search: search || undefined,
        limit: 50,
      }),
      getServerMetricsAction(),
    ]);
    setLoading(false);

    if (logsRes.success && logsRes.logs) {
      // Filter out WAF only if we want purely server/security/auth, or keep all
      setServerLogs(logsRes.logs as SerializedSystemLog[]);
    }
    if (metricsRes.success && metricsRes.metrics) {
      setMetrics(metricsRes.metrics);
    }
  };

  // Handle Simulasi Serangan WAF
  const handleSimulateAttack = (attackType: string) => {
    startTransition(async () => {
      setLoading(true);
      const res = await simulateWafAttackAction(attackType);
      setLoading(false);
      if (res.success) {
        setMsg({ text: res.message, success: true });
        if (res.log) {
          setWafLogs((prev) => [res.log as SerializedSystemLog, ...prev]);
        }
      } else {
        setMsg({ text: res.message, success: false });
      }
    });
  };

  // Handle Manual Cron Cleanup
  const handleManualCron = async () => {
    setLoading(true);
    const res = await triggerManualCronCleanupAction();
    setLoading(false);
    if (res.success) {
      setMsg({ text: res.message, success: true });
      fetchServerLogsAndMetrics();
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  // Handle Pembersihan Log Lama
  const handleClearOldLogs = async () => {
    if (!confirm("Bersihkan semua log sistem yang berumur lebih dari 7 hari?")) return;
    setLoading(true);
    const res = await clearOldLogsAction(7);
    setLoading(false);
    if (res.success) {
      setMsg({ text: res.message, success: true });
      fetchWafLogs();
      fetchServerLogsAndMetrics();
    } else {
      setMsg({ text: res.message, success: false });
    }
  };

  // Filtered Users
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Admin Dashboard & Keamanan
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manajemen pengguna, audit pesanan, pengawasan firewall (WAF), dan diagnostik kesehatan server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            WAF & Server Online
          </span>
        </div>
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

      {/* Ringkasan Statistik Ekosistem */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">Total Pengguna</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
        </div>
        <div className="bg-white p-3.5 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">Petani Terdaftar</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.petaniCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">Toko Hub Aktif</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.hubCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-md border border-gray-200">
          <span className="text-xs font-medium text-gray-500 block">Restoran Mitra</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.restaurantCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-md border border-gray-200 border-l-4 border-l-emerald-500 col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-gray-500 block">Perputaran GMV</span>
          <p className="text-base font-bold text-emerald-600 mt-1">
            Rp {stats.totalGMV.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Navigasi Tab */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("USERS")}
          className={`py-2.5 px-4 font-medium text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === "USERS"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Manajemen Pengguna ({userList.length})
        </button>
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`py-2.5 px-4 font-medium text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === "ORDERS"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Pengawasan Transaksi ({orders.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("WAF");
            fetchWafLogs();
          }}
          className={`py-2.5 px-4 font-medium text-xs border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === "WAF"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>🛡️ Log Aktivitas WAF</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
            {metrics.stats.totalWafLogs}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("SERVER");
            fetchServerLogsAndMetrics();
          }}
          className={`py-2.5 px-4 font-medium text-xs border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === "SERVER"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>🖥️ Log Aktivitas Server & Sistem</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
            {metrics.stats.totalServerLogs}
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: MANAJEMEN PENGGUNA
         ======================================================== */}
      {activeTab === "USERS" && (
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
                        className="text-xs font-medium rounded-md px-2 py-1 border border-gray-300 outline-none bg-white text-gray-700 focus:border-emerald-500 cursor-pointer"
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
                      {u.role === "ADMIN" && `Administrator`}
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
      )}

      {/* ========================================================
          TAB 2: PENGAWASAN TRANSAKSI
         ======================================================== */}
      {activeTab === "ORDERS" && (
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

      {/* ========================================================
          TAB 3: LOG AKTIVITAS WAF (FIREWALL KEAMANAN)
         ======================================================== */}
      {activeTab === "WAF" && (
        <div className="space-y-4">
          {/* Kartu Status Proteksi WAF */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Total Ancaman WAF Dicegah</span>
              <p className="text-xl font-bold text-rose-600 mt-1">{metrics.stats.totalWafLogs}</p>
              <span className="text-[11px] text-gray-400">Sepanjang riwayat operasional</span>
            </div>
            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Serangan 24 Jam Terakhir</span>
              <p className="text-xl font-bold text-amber-600 mt-1">{metrics.stats.recentWafThreats24h}</p>
              <span className="text-[11px] text-gray-400">Rate Limit & Probe otomatis</span>
            </div>
            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Status Mesin WAF</span>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-700">PROTEKSI AKTIF</span>
              </div>
              <span className="text-[11px] text-gray-400">Inspeksi Lapis Middleware & API</span>
            </div>
            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Cakupan Aturan WAF</span>
              <p className="text-xs font-semibold text-gray-800 mt-1">
                SQLi, XSS, Path Traversal, SSRF, Magic Bytes, Rate Limiter
              </p>
              <span className="text-[11px] text-emerald-600">OWASP Top 10 Terlindungi</span>
            </div>
          </div>

          {/* Panel Simulator Pengujian WAF (Demo Skripsi / Sidang TA) */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>⚡ Simulator Pengujian Pertahanan WAF</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                    Mode Pengujian / Evaluasi TA
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Uji respon dan pencatatan WAF secara langsung terhadap skenario serangan keamanan umum.
                </p>
              </div>
              <span className="text-[11px] text-slate-400">Klik tombol untuk memicu simulasi:</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSimulateAttack("SQLI")}
                disabled={loading || isPending}
                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-rose-700 border border-rose-200 rounded-md transition shadow-sm cursor-pointer"
              >
                💉 Uji Injeksi SQL (UNION SELECT)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateAttack("XSS")}
                disabled={loading || isPending}
                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded-md transition shadow-sm cursor-pointer"
              >
                🌐 Uji XSS Payload (&lt;script&gt;)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateAttack("PATH_TRAVERSAL")}
                disabled={loading || isPending}
                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-purple-700 border border-purple-200 rounded-md transition shadow-sm cursor-pointer"
              >
                📁 Uji Path Traversal (../../etc/passwd)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateAttack("RATE_LIMIT")}
                disabled={loading || isPending}
                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-orange-700 border border-orange-200 rounded-md transition shadow-sm cursor-pointer"
              >
                ⏱️ Uji Rate Limit (Flood 15 Req)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateAttack("MAGIC_BYTES")}
                disabled={loading || isPending}
                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-md transition shadow-sm cursor-pointer"
              >
                🖼️ Uji Magic Bytes (Polyglot Fake JPG)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateAttack("SSRF")}
                disabled={loading || isPending}
                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-red-700 border border-red-200 rounded-md transition shadow-sm cursor-pointer"
              >
                ☁️ Uji SSRF (Cloud Metadata IP)
              </button>
            </div>
          </div>

          {/* Kontrol Filter & Pencarian Log WAF */}
          <div className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Cari IP, aksi, endpoint, atau pesan..."
                  value={wafSearch}
                  onChange={(e) => setWafSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchWafLogs(wafSeverityFilter, wafSearch);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-xs outline-none focus:border-emerald-500 w-full sm:w-64"
                />

                <select
                  value={wafSeverityFilter}
                  onChange={(e) => {
                    setWafSeverityFilter(e.target.value);
                    fetchWafLogs(e.target.value, wafSearch);
                  }}
                  className="border border-gray-300 rounded-md px-2.5 py-1.5 text-xs outline-none bg-white text-gray-700 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Severity</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="ALERT">ALERT</option>
                  <option value="WARN">WARN</option>
                  <option value="INFO">INFO</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchWafLogs(wafSeverityFilter, wafSearch)}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition cursor-pointer"
                >
                  Cari / Refresh
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearOldLogs}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-md transition bg-white cursor-pointer"
                >
                  Bersihkan Log (&gt;7 Hari)
                </button>
              </div>
            </div>

            {/* Tabel Log WAF */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-500 border-b border-gray-200 font-medium">
                  <tr>
                    <th className="p-3 w-36">Waktu Kejadian (WIB)</th>
                    <th className="p-3 w-24">Severity</th>
                    <th className="p-3 w-48">Aksi / Tipe Serangan</th>
                    <th className="p-3 w-40">Client IP / Method</th>
                    <th className="p-3">Deskripsi Ancaman & Target</th>
                    <th className="p-3 text-right w-24">Inspeksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {wafLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400">
                        Belum ada aktivitas WAF yang tercatat atau cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    wafLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] border ${getSeverityBadge(
                              log.severity
                            )}`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium text-gray-900 text-[11px]">
                          {log.action}
                        </td>
                        <td className="p-3 text-gray-600 font-mono text-[11px]">
                          <div>{log.ipAddress || "127.0.0.1"}</div>
                          <div className="text-[10px] text-gray-400">{log.method || "HTTP"}</div>
                        </td>
                        <td className="p-3 text-gray-700">
                          <div className="font-medium text-gray-900">{log.message}</div>
                          {log.endpoint && (
                            <div className="text-[11px] text-gray-400 font-mono truncate max-w-md">
                              Endpoint: {log.endpoint}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {log.metadata && Object.keys(log.metadata as object).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedMetaLog(log)}
                              className="text-emerald-600 hover:text-emerald-700 font-medium text-[11px] underline cursor-pointer"
                            >
                              Detail Payload
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: LOG AKTIVITAS SERVER & KESEHATAN SISTEM
         ======================================================== */}
      {activeTab === "SERVER" && (
        <div className="space-y-4">
          {/* Status Server & Diagnostic Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Status Runtime Server</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-bold text-gray-900">
                  {metrics.server.environment.toUpperCase()}
                </span>
              </div>
              <span className="text-[11px] text-gray-400">
                Uptime: {formatUptime(metrics.server.uptimeSeconds)} ({metrics.server.platform})
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Basis Data PostgreSQL</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-emerald-700">
                  {metrics.database.status}
                </span>
                <span className="text-xs font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  {metrics.database.latencyMs} ms
                </span>
              </div>
              <span className="text-[11px] text-gray-400">{metrics.database.provider}</span>
            </div>

            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Rate Limiter & Cache</span>
              <p className="text-xs font-bold text-gray-800 mt-1">
                {metrics.rateLimiter.backend}
              </p>
              <span className="text-[11px] text-emerald-600">
                Status: {metrics.rateLimiter.status}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-md border border-gray-200">
              <span className="text-xs font-medium text-gray-500 block">Konsumsi Memori Node</span>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {metrics.server.memory.heapUsedMB} MB / {metrics.server.memory.heapTotalMB} MB
              </p>
              <span className="text-[11px] text-gray-400">
                RSS: {metrics.server.memory.rssMB} MB ({metrics.server.nodeVersion})
              </span>
            </div>
          </div>

          {/* Quick Actions Operasional Server */}
          <div className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900">Operasional & Pemeliharaan Server</h3>
                <p className="text-[11px] text-gray-500">
                  Jalankan tugas pembersihan berkala latar belakang (Cron) atau periksa log audit administratif.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualCron}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition shadow-sm cursor-pointer"
                >
                  🧹 Jalankan Cron Cleanup Manual
                </button>
                <button
                  type="button"
                  onClick={() => fetchServerLogsAndMetrics()}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition cursor-pointer"
                >
                  🔄 Refresh Metrik
                </button>
              </div>
            </div>

            {/* Filter Log Server */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                placeholder="Cari log server (aksi, pesan, endpoint)..."
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchServerLogsAndMetrics(serverSearch);
                }}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-xs outline-none focus:border-emerald-500 w-full max-w-sm"
              />
              <button
                type="button"
                onClick={() => fetchServerLogsAndMetrics(serverSearch)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition cursor-pointer"
              >
                Cari
              </button>
            </div>

            {/* Tabel Log Server & Audit */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-500 border-b border-gray-200 font-medium">
                  <tr>
                    <th className="p-3 w-36">Waktu (WIB)</th>
                    <th className="p-3 w-20">Kategori</th>
                    <th className="p-3 w-24">Severity</th>
                    <th className="p-3 w-48">Aksi Sistem</th>
                    <th className="p-3">Pesan Log & Rincian</th>
                    <th className="p-3 text-right w-24">Inspeksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {serverLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400">
                        Belum ada aktivitas server tercatat.
                      </td>
                    </tr>
                  ) : (
                    serverLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="p-3 font-semibold text-gray-700 text-[11px]">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              log.type === "WAF"
                                ? "bg-rose-50 text-rose-700"
                                : log.type === "AUTH"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {log.type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] border ${getSeverityBadge(
                              log.severity
                            )}`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium text-gray-900 text-[11px]">
                          {log.action}
                        </td>
                        <td className="p-3 text-gray-700">
                          <div className="font-medium text-gray-900">{log.message}</div>
                          {log.endpoint && (
                            <div className="text-[11px] text-gray-400 font-mono truncate max-w-md">
                              Endpoint: {log.endpoint}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {log.metadata && Object.keys(log.metadata as object).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedMetaLog(log)}
                              className="text-emerald-600 hover:text-emerald-700 font-medium text-[11px] underline cursor-pointer"
                            >
                              Metadata
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Metadata Log / Payload Inspector */}
      {selectedMetaLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-gray-200 max-w-xl w-full p-4 space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>Inspeksi Rincian Payload Log</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] border ${getSeverityBadge(
                      selectedMetaLog.severity
                    )}`}
                  >
                    {selectedMetaLog.severity}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  ID: {selectedMetaLog.id} | Aksi: {selectedMetaLog.action}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMetaLog(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-gray-700">Pesan:</span>
                <p className="text-gray-900 mt-0.5">{selectedMetaLog.message}</p>
              </div>

              {selectedMetaLog.endpoint && (
                <div>
                  <span className="font-semibold text-gray-700">Target Endpoint / Path:</span>
                  <p className="text-gray-800 font-mono text-[11px] bg-gray-50 p-1.5 rounded mt-0.5">
                    {selectedMetaLog.method || "HTTP"} {selectedMetaLog.endpoint}
                  </p>
                </div>
              )}

              {selectedMetaLog.ipAddress && (
                <div>
                  <span className="font-semibold text-gray-700">Alamat IP Client:</span>
                  <p className="text-gray-800 font-mono text-[11px] mt-0.5">
                    {selectedMetaLog.ipAddress}
                  </p>
                </div>
              )}

              {selectedMetaLog.userAgent && (
                <div>
                  <span className="font-semibold text-gray-700">User Agent:</span>
                  <p className="text-gray-600 font-mono text-[10px] bg-gray-50 p-1.5 rounded mt-0.5 break-all">
                    {selectedMetaLog.userAgent}
                  </p>
                </div>
              )}

              <div>
                <span className="font-semibold text-gray-700">Raw Metadata / Sanitized Payload:</span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded text-[11px] font-mono overflow-x-auto max-h-56 mt-1">
                  {JSON.stringify(selectedMetaLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedMetaLog(null)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-md transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
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
