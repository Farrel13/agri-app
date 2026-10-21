"use client";

import Link from "next/link";
import { addProductAction } from "../actions";
import { useRouter } from "next/navigation";

export default function HalamanTambahPanen() {
      const router = useRouter();

      const handleSubmit = async (formData: FormData) => {
        const res = await addProductAction(formData);
        if (res.success) {
          alert(res.message);
          router.push("/petani");
        } else {
          alert(res.message);
        }
      };
      return (
        <div className="p-8 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Tambah Panen Baru</h1>
            <Link href="/petani" className="text-gray-500 hover:text-gray-700">
              Kembali
            </Link>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            {/* Form memanggil fungsi tambahPanen dari Server Action */}
            <form action={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="Contoh: Wortel Organik"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-green-500 focus:border-green-500 text-gray-900" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Stok</label>
                  <input 
                    type="number" 
                    name="stock" 
                    required 
                    min="1"
                    placeholder="Contoh: 100"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <select name="unit" className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900">
                    <option value="Kg">Kilogram (Kg)</option>
                    <option value="Ikat">Ikat</option>
                    <option value="Karung">Karung</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual ke Hub (Rp)</label>
                <input 
                  type="number" 
                  name="buyPrice" 
                  required 
                  min="1000"
                  placeholder="Contoh: 15000"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-green-600 text-white font-bold py-3 rounded mt-4 hover:bg-green-700 transition"
              >
                Simpan & Ajukan ke Hub
              </button>
            </form>
          </div>
        </div>
      );
}
