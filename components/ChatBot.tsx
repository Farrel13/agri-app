"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// Tipe pesan dalam UI
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// Tipe history untuk Gemini API (multi-turn)
interface GeminiHistory {
  role: "user" | "model";
  parts: { text: string }[];
}

// Saran pertanyaan per role
const SUGGESTIONS: Record<string, string[]> = {
  PETANI: [
    "Berapa total stok produk saya?",
    "Produk mana yang sudah terverifikasi Hub?",
    "Berapa estimasi pendapatan saya?",
    "Panen mana yang belum diverifikasi?",
  ],
  HUB: [
    "Ada berapa panen yang menunggu verifikasi?",
    "Pesanan apa yang sedang diproses?",
    "Berapa total pendapatan dari pesanan selesai?",
    "Produk apa saja yang ada di etalase saya?",
  ],
  RESTAURANT: [
    "Produk apa yang tersedia sekarang?",
    "Status pesanan saya yang terakhir?",
    "Kapan pesanan saya sampai?",
    "Produk dengan rating terbaik apa?",
  ],
  ADMIN: [
    "Berapa total pengguna per role?",
    "Berapa total nilai transaksi?",
    "Statistik pesanan platform?",
    "Rata-rata harga produk petani?",
  ],
};

export default function ChatBot() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [geminiHistory, setGeminiHistory] = useState<GeminiHistory[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const userRole = (session?.user as { role?: string })?.role || "PETANI";
  const userName = session?.user?.name || "Pengguna";
  const suggestions = SUGGESTIONS[userRole] || SUGGESTIONS["PETANI"];

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input saat dibuka
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Tambahkan pesan selamat datang
      const welcomeMsg: Message = {
        id: "welcome",
        role: "assistant",
        content: `Halo, **${userName}**! 👋\n\nSaya **Agri-AI**, asisten cerdas AgriApp. Saya bisa menjawab pertanyaan seputar data ${
          userRole === "PETANI"
            ? "panen, stok, dan penjualan Anda"
            : userRole === "HUB"
            ? "verifikasi panen, etalase, dan pesanan masuk"
            : userRole === "RESTAURANT"
            ? "produk tersedia, pesanan, dan status pengiriman"
            : "statistik platform AgriApp"
        }.\n\nAda yang bisa saya bantu?`,
        timestamp: new Date(),
      };
      setMessages([welcomeMsg]);
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue("");
      setIsLoading(true);

      // Siapkan history (tanpa pesan welcome)
      const currentHistory: GeminiHistory[] = [
        ...geminiHistory,
        { role: "user", parts: [{ text: text.trim() }] },
      ];

      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            history: geminiHistory,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${res.status}`);
        }

        // Stream response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: fullText, isStreaming: true }
                  : m
              )
            );
          }
        }

        // Tandai selesai streaming
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );

        // Simpan ke Gemini history untuk multi-turn
        setGeminiHistory([
          ...currentHistory,
          { role: "model", parts: [{ text: fullText }] },
        ]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const errMsg =
          err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${errMsg}`, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, geminiHistory]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleClose = () => {
    abortControllerRef.current?.abort();
    setIsOpen(false);
  };

  const clearChat = () => {
    setMessages([]);
    setGeminiHistory([]);
    setIsOpen(false);
    setTimeout(() => setIsOpen(true), 50);
  };

  // Hanya tampil jika sudah login
  if (status !== "authenticated") return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
        aria-label={isOpen ? "Tutup Agri-AI" : "Buka Agri-AI"}
        title="Agri-AI Assistant"
      >
        {isOpen ? (
          // X icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Chat icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-green-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm font-bold">AI</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Agri-AI</p>
                <p className="text-green-100 text-xs">Powered by Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="text-green-100 hover:text-white text-xs px-2 py-1 rounded hover:bg-green-700 transition-colors"
                title="Reset percakapan"
              >
                Reset
              </button>
              <button onClick={handleClose} className="text-green-100 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-green-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
                  }`}
                >
                  {/* Render basic markdown: bold */}
                  <div
                    className="whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/^• /gm, "• ")
                        .replace(/^- /gm, "• "),
                    }}
                  />
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-green-500 ml-1 animate-pulse rounded" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions (hanya ketika belum ada percakapan) */}
          {messages.length <= 1 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-white flex-shrink-0">
              <p className="text-xs text-gray-400 mb-2">Pertanyaan umum:</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-1 hover:bg-green-100 transition-colors truncate max-w-full"
                    disabled={isLoading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="px-3 py-3 border-t border-gray-200 bg-white flex items-end gap-2 flex-shrink-0"
          >
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya sesuatu tentang data Anda..."
              rows={1}
              maxLength={1000}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 max-h-24 overflow-auto"
              style={{ minHeight: "38px" }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-9 h-9 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
