const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PT_PER_CM = 72 / 2.54; // ~28.3465 pt per cm

// Helper to convert integer to roman numeral
function toRoman(num) {
  const lookup = [
    ['m', 1000], ['cm', 900], ['d', 500], ['cd', 400],
    ['c', 100], ['xc', 90], ['l', 50], ['xl', 40],
    ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]
  ];
  let roman = '';
  for (const [letter, val] of lookup) {
    while (num >= val) {
      roman += letter;
      num -= val;
    }
  }
  return roman;
}

// Global styles strictly adhering to guide
const BASE_CSS = `
  @page {
    size: A4;
    margin-top: 4cm;
    margin-left: 4cm;
    margin-bottom: 3cm;
    margin-right: 3cm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: Tahoma, sans-serif;
    font-size: 12pt;
    line-height: 1.15;
    color: #000;
    margin: 0;
    padding: 0;
    text-align: justify;
  }
  .page-break {
    page-break-before: always;
  }
  
  /* Heading tajuk bab */
  .tajuk-bab-container {
    text-align: center;
    margin-bottom: 1.5em; /* 1.5 spasi ke teks pertama / anak bab */
  }
  .petunjuk-bab {
    font-weight: bold;
    font-size: 12pt;
    text-transform: uppercase;
    line-height: 1.5;
    margin-bottom: 0.5em; /* 1.5 spasi ke tajuk bab */
  }
  .tajuk-bab {
    font-weight: bold;
    font-size: 12pt;
    text-transform: uppercase;
    line-height: 1.5;
  }
  
  /* Tajuk non-bab (Ringkasan, Kata Pengantar, dll) */
  .tajuk-tunggal {
    text-align: center;
    font-weight: bold;
    font-size: 12pt;
    text-transform: uppercase;
    line-height: 1.5;
    margin-bottom: 1.5em;
  }
  .tajuk-ringkasan {
    text-align: center;
    font-weight: bold;
    font-size: 12pt;
    text-transform: uppercase;
    line-height: 1.5;
    margin-bottom: 3em; /* 3 spasi antara judul ringkasan dengan teks pertama */
  }

  /* Subbab / Anak bab */
  .anak-bab {
    font-weight: bold;
    font-size: 12pt;
    line-height: 1.5;
    margin-top: 2em; /* 2 spasi dari baris akhir teks sebelumnya */
    margin-bottom: 1.5em; /* 1.5 spasi ke baris pertama teks */
    text-align: left;
  }
  .sub-anak-bab {
    font-weight: bold;
    font-size: 12pt;
    line-height: 1.5;
    margin-top: 1.5em;
    margin-bottom: 1em;
    text-align: left;
  }

  /* Paragraf & Teks */
  p {
    margin-top: 0;
    margin-bottom: 1.15em; /* 1.15 spasi antar alinea */
    line-height: 1.15;
    text-indent: 1.25cm; /* 7 ketukan / 1 tab */
  }
  p.no-indent {
    text-indent: 0;
  }

  /* Ringkasan & Summary spesifik: 1 spasi, antar alinea 1 spasi */
  .ringkasan-text p {
    line-height: 1.0;
    margin-bottom: 1.0em;
    text-indent: 1.25cm;
  }

  /* Istilah asing / Inggris miring */
  em, i, .foreign {
    font-style: italic;
  }

  /* Kutipan langsung >= 5 baris: 1 spasi, menjorok 5 ketukan (1cm), terpisah 1.15 spasi */
  blockquote.kutipan-panjang {
    margin-left: 1cm;
    margin-right: 0;
    margin-top: 1.15em;
    margin-bottom: 1.15em;
    line-height: 1.0;
    font-size: 11pt;
    text-align: justify;
  }

  /* Tabel styling */
  .table-container {
    margin-top: 1.15em;
    margin-bottom: 1.15em;
    page-break-inside: avoid;
  }
  .table-title {
    font-weight: bold;
    font-size: 11pt;
    margin-bottom: 0.5em;
    line-height: 1.15;
    text-align: left;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    line-height: 1.15;
  }
  th, td {
    border: 1px solid #000;
    padding: 5px 8px;
    vertical-align: top;
  }
  th {
    background-color: #f2f2f2;
    font-weight: bold;
    text-align: center;
  }

  /* Gambar / Diagram styling */
  .figure-container {
    margin-top: 1.15em;
    margin-bottom: 1.15em;
    text-align: center;
    page-break-inside: avoid;
  }
  .figure-box {
    border: 1px solid #666;
    background: #fafafa;
    padding: 12px;
    margin-bottom: 0.5em;
    display: inline-block;
    width: 95%;
    text-align: left;
    font-size: 9.5pt;
    font-family: Consolas, monospace;
    white-space: pre-wrap;
  }
  .figure-caption {
    font-weight: bold;
    font-size: 11pt;
    line-height: 1.15;
    text-align: center;
    margin-top: 0.4em;
  }

  /* Code snippet styling */
  pre.code-block {
    background-color: #f8f9fa;
    border: 1px solid #ccc;
    border-left: 4px solid #10b981;
    padding: 8px 12px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 9.5pt;
    line-height: 1.15;
    overflow-x: auto;
    margin-top: 0.8em;
    margin-bottom: 1.15em;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Daftar Pustaka: hanging indent */
  .daftar-pustaka p {
    text-indent: -1.25cm;
    margin-left: 1.25cm;
    margin-bottom: 1.15em;
    line-height: 1.15;
  }

  /* Cover & Pengesahan */
  .cover-title {
    text-align: center;
    font-weight: bold;
    font-size: 14pt;
    line-height: 1.5;
    margin-top: 2cm;
    margin-bottom: 2cm;
    text-transform: uppercase;
  }
  .cover-subtitle {
    text-align: center;
    font-size: 12pt;
    margin-bottom: 2cm;
  }
  .cover-author {
    text-align: center;
    font-size: 12pt;
    line-height: 1.3;
    margin-top: 3cm;
  }
  .cover-instansi {
    text-align: center;
    font-weight: bold;
    font-size: 12pt;
    line-height: 1.4;
    margin-top: 4cm;
    text-transform: uppercase;
  }

  /* Daftar isi titik-titik */
  .toc-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5em;
    line-height: 1.2;
  }
  .toc-title {
    flex-grow: 1;
    position: relative;
    overflow: hidden;
  }
  .toc-title::after {
    content: " .................................................................................................................................................................";
    position: absolute;
    padding-left: 5px;
    color: #444;
  }
  .toc-page {
    padding-left: 10px;
    background: #fff;
    z-index: 2;
  }
`;

// Build HTML for Bagian Awal (Roman pages: i to vi)
// Note: Cover is page 1 (i) but unnumbered. Pengesahan is ii, Ringkasan is iii, Summary iv, Kata Pengantar v, Daftar Isi vi.
function buildBagianAwalHTML() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>

  <!-- HALAMAN 1: JUDUL BAGIAN DALAM (Hanya Judul saja, diperhitungkan sbg halaman i, nomor tidak dicetak) -->
  <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
    <div class="cover-title" style="margin-top: 5cm; margin-bottom: 0;">
      PENGEMBANGAN PLATFORM DIGITAL RANTAI PASOK AGRIKULTUR BERBASIS WEB MENGGUNAKAN NEXT.JS DAN PRISMA ORM DENGAN MEKANISME <span class="foreign">MULTI-VENDOR SPLIT ORDER</span> DAN KEAMANAN BERLAPIS
    </div>
  </div>

  <!-- HALAMAN 2: LEMBAR PENGESAHAN (Halaman ii - Dikosongkan) -->
  <div class="page-break">
    <div style="height: 100%; min-height: 20cm;">
      <!-- Halaman Lembar Pengesahan dikosongkan sesuai permintaan -->
      &nbsp;
    </div>
  </div>

  <!-- HALAMAN 3: RINGKASAN (Halaman iii) -->
  <div class="page-break">
    <div class="tajuk-ringkasan">RINGKASAN</div>
    <div class="ringkasan-text">
      <p>Sektor pertanian di Indonesia memegang peranan krusial bagi ketahanan pangan dan perekonomian nasional. Namun, mata rantai distribusi hasil pertanian konvensional yang melibatkan banyak perantara pedagang informal (<span class="foreign">tengkulak</span>) menyebabkan disparitas harga yang ekstrem antara tingkat petani dan konsumen, mencapai 200% hingga 400%. Petani dirugikan dengan perolehan keuntungan yang minim, sedangkan pembeli komersial seperti restoran kesulitan mendapatkan jaminan pasokan bahan segar dengan kualitas terverifikasi dan harga yang transparan. Penelitian Tugas Akhir ini bertujuan untuk merancang dan membangun platform web rantai pasok agrikultur (<span class="foreign">AgriApp</span>) yang menghubungkan tiga entitas utama: Petani, Toko Hub (pengepul/agregator), dan Restoran secara langsung.</p>
      <p>Sistem ini dikembangkan menggunakan kerangka kerja modern <span class="foreign">Next.js 16</span> dengan arsitektur <span class="foreign">React Server Components</span> dan <span class="foreign">Server Actions</span>, didukung basis data relasional <span class="foreign">PostgreSQL</span> melalui <span class="foreign">Prisma ORM</span>. Sistem mengintegrasikan hak akses berbasis peran (<span class="foreign">Role-Based Access Control</span>/RBAC), fitur kurasi mutu hasil panen dengan foto berbatas kedaluwarsa 24 jam, pemisahan pesanan otomatis multi-vendor (<span class="foreign">multi-vendor split order</span>) secara atomik, penegakan <span class="foreign">state machine</span> alur pesanan, serta inspeksi forensik berkas gambar (<span class="foreign">magic bytes</span>) dan <span class="foreign">rate limiting</span> terdistribusi via <span class="foreign">Upstash Redis</span>. Pengujian fungsionalitas dilakukan menggunakan metode <span class="foreign">Black-Box Testing</span> dengan 28 skenario pengujian.</p>
      <p>Hasil pengujian menunjukkan seluruh skenario uji fungsional dan keamanan berhasil dengan status valid 100%. Platform ini terbukti mampu memfasilitasi transaksi digital yang aman, memotong mata rantai spekulasi perantara, serta meningkatkan efisiensi operasional pengadaan bahan pangan segar.</p>
      <p class="no-indent" style="margin-top: 1cm; font-weight: bold;">
        Kata Kunci: Rantai Pasok Agrikultur, Next.js, Prisma ORM, <span class="foreign">Split Order</span>, RBAC, <span class="foreign">Black-Box Testing</span>.
      </p>
    </div>
  </div>

  <!-- HALAMAN 4: SUMMARY (Halaman iv) -->
  <div class="page-break">
    <div class="tajuk-ringkasan">SUMMARY</div>
    <div class="ringkasan-text">
      <p><em>The agricultural sector in Indonesia plays a crucial role in national food security and economic stability. However, the conventional agricultural distribution supply chain involves multiple informal middlemen, leading to extreme price disparity between farmers and commercial consumers ranging from 200% to 400%. Smallholder farmers suffer from minimal profit margins, while commercial buyers such as restaurants struggle with food freshness verification and delivery tracking. This Final Project aims to design and develop an integrated web-based agricultural supply chain platform (<span class="foreign">AgriApp</span>) that directly bridges three primary stakeholders: Farmers, Hub Stores (aggregators), and Restaurants.</em></p>
      <p><em>The platform is engineered using modern <span class="foreign">Next.js 16</span> utilizing <span class="foreign">React Server Components</span> and <span class="foreign">Server Actions</span>, integrated with a <span class="foreign">PostgreSQL</span> relational database via <span class="foreign">Prisma ORM</span>. Key technical innovations include <span class="foreign">Role-Based Access Control</span> (RBAC), 24-hour time-to-live harvest photo freshness verification, atomic multi-vendor split order orchestration, order state-machine enforcement, binary magic bytes image inspection, and distributed sliding-window rate limiting via <span class="foreign">Upstash Redis</span>. System functionality and security validations were comprehensively evaluated using <span class="foreign">Black-Box Testing</span> across 28 rigorous test scenarios.</em></p>
      <p><em>The evaluation results demonstrate a 100% validity rate across all functional and security test cases. The platform successfully automates transactional data flows, mitigates race conditions in inventory allocations, eliminates predatory middleman markup, and ensures reliable farm-to-table traceability.</em></p>
      <p class="no-indent" style="margin-top: 1cm; font-weight: bold;">
        Keywords: Agricultural Supply Chain, Next.js, Prisma ORM, Multi-Vendor Split Order, RBAC, Black-Box Testing.
      </p>
    </div>
  </div>

  <!-- HALAMAN 5: KATA PENGANTAR (Halaman v) -->
  <div class="page-break">
    <div class="tajuk-tunggal">KATA PENGANTAR</div>
    <p>Puji dan syukur penulis panjatkan ke hadirat Tuhan Yang Maha Esa atas berkat, rahmat, dan karunia-Nya, sehingga penulis dapat menyelesaikan penulisan naskah Tugas Akhir yang berjudul <strong>"Pengembangan Platform Digital Rantai Pasok Agrikultur Berbasis Web Menggunakan Next.js dan Prisma ORM dengan Mekanisme Multi-Vendor Split Order dan Keamanan Berlapis"</strong> dengan baik dan tepat pada waktunya.</p>
    <p>Penyusunan naskah Tugas Akhir ini diajukan sebagai salah satu syarat akademis guna menyelesaikan studi dan memperoleh gelar Sarjana Komputer pada Program Studi Teknik Informatika, Fakultas Ilmu Komputer. Selama proses perancangan, implementasi sistem, hingga penyusunan laporan ini, penulis mendapatkan bimbingan, arahan, saran, serta dukungan moral dari berbagai pihak. Oleh karena itu, pada kesempatan ini penulis ingin menyampaikan rasa terima kasih dan penghargaan yang tulus kepada:</p>
    <p class="no-indent">1. Bapak Prof. Dr. Ir. Budi Santoso, M.T., selaku Ketua Program Studi Teknik Informatika yang senantiasa memfasilitasi kelancaran proses akademik.<br>
    2. Bapak Dr. Ir. Hendra Wijaya, M.Kom., selaku Dosen Pembimbing I yang telah meluangkan waktu, memberikan arahan arsitektur perangkat lunak, serta bimbingan yang sangat berharga dalam penyusunan tugas akhir ini.<br>
    3. Ibu Siti Nurhaliza, S.T., M.T., selaku Dosen Pembimbing II yang senantiasa memberikan masukan teknis dan evaluasi kritis demi kesempurnaan sistem dan laporan.<br>
    4. Seluruh Dosen dan Staf Pengajar Program Studi Teknik Informatika yang telah membekali penulis dengan berbagai ilmu pengetahuan selama masa perkuliahan.<br>
    5. Orang tua dan segenap keluarga tercinta atas doa yang tiada putus, dorongan semangat, dan pengorbanan yang tak ternilai harganya.<br>
    6. Rekan-rekan mahasiswa Teknik Informatika dan seluruh pihak yang telah membantu secara langsung maupun tidak langsung dalam penyelesaian tugas akhir ini.</p>
    <p>Penulis menyadari bahwa naskah Tugas Akhir ini masih memiliki keterbatasan. Oleh sebab itu, kritik dan saran yang bersifat membangun sangat penulis harapkan guna penyempurnaan di masa mendatang. Semoga karya tulis ini dapat memberikan manfaat nyata bagi pengembangan ilmu pengetahuan dan digitalisasi agrikultur di Indonesia.</p>
    <table style="border: none; margin-top: 1cm; width: 100%;">
      <tr style="border: none;">
        <td style="border: none; width: 60%;"></td>
        <td style="border: none; width: 40%; text-align: center;">
          Jakarta, November 2026<br><br><br><br>
          <strong>Penulis</strong>
        </td>
      </tr>
    </table>
  </div>

  <!-- HALAMAN 6: DAFTAR ISI (Halaman vi) -->
  <div class="page-break">
    <div class="tajuk-tunggal">DAFTAR ISI</div>
    <div style="font-size: 11pt; line-height: 1.3;">
      <div class="toc-row"><strong>HALAMAN JUDUL</strong><span class="toc-page">i</span></div>
      <div class="toc-row"><strong>LEMBAR PENGESAHAN</strong><span class="toc-page">ii</span></div>
      <div class="toc-row"><strong>RINGKASAN</strong><span class="toc-page">iii</span></div>
      <div class="toc-row"><strong>SUMMARY</strong><span class="toc-page">iv</span></div>
      <div class="toc-row"><strong>KATA PENGANTAR</strong><span class="toc-page">v</span></div>
      <div class="toc-row"><strong>DAFTAR ISI</strong><span class="toc-page">vi</span></div>
      <div class="toc-row"><strong>DAFTAR TABEL</strong><span class="toc-page">vii</span></div>
      <div class="toc-row"><strong>DAFTAR GAMBAR</strong><span class="toc-page">viii</span></div>
      
      <div class="toc-row" style="margin-top: 0.5em;"><strong>BAB I : PENDAHULUAN</strong><span class="toc-page">1</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">1.1 Latar Belakang<span class="toc-page">1</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">1.2 Rumusan Masalah<span class="toc-page">3</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">1.3 Batasan Masalah<span class="toc-page">3</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">1.4 Tujuan Tugas Akhir<span class="toc-page">4</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">1.5 Manfaat Tugas Akhir<span class="toc-page">5</span></div>

      <div class="toc-row" style="margin-top: 0.5em;"><strong>BAB II : KAJIAN PUSTAKA</strong><span class="toc-page">6</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.1 Rantai Pasok Agrikultur (<span class="foreign">Agricultural Supply Chain</span>)<span class="toc-page">6</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.2 Sistem Informasi Berbasis Web<span class="toc-page">7</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.3 Kerangka Kerja Next.js dan <span class="foreign">Server Actions</span><span class="toc-page">7</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.4 React dan TypeScript<span class="toc-page">8</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.5 Prisma ORM dan PostgreSQL<span class="toc-page">9</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.6 NextAuth.js dan Autentikasi JWT<span class="toc-page">10</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.7 Tailwind CSS<span class="toc-page">10</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.8 Upstash Redis dan <span class="foreign">Rate Limiting</span><span class="toc-page">11</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">2.9 Telaah Penelitian Terdahulu Relevan (2022–2024)<span class="toc-page">11</span></div>

      <div class="toc-row" style="margin-top: 0.5em;"><strong>BAB III : METODE PENYELESAIAN TUGAS AKHIR</strong><span class="toc-page">14</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">3.1 Alur Pelaksanaan Tugas Akhir<span class="toc-page">14</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">3.2 Analisis Kebutuhan Sistem<span class="toc-page">15</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">3.3 Perancangan Basis Data (<span class="foreign">Data Dictionary</span>)<span class="toc-page">17</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">3.4 Perancangan Diagram Pemodelan Sistem<span class="toc-page">20</span></div>

      <div class="toc-row" style="margin-top: 0.5em;"><strong>BAB IV : HASIL DAN PEMBAHASAN</strong><span class="toc-page">24</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">4.1 Implementasi Antarmuka dan Kode Program Inti<span class="toc-page">24</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">4.2 Pengujian Sistem (<span class="foreign">Black-Box Testing</span>)<span class="toc-page">29</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">4.3 Pembahasan Evaluasi Kinerja dan Keamanan Sistem<span class="toc-page">32</span></div>

      <div class="toc-row" style="margin-top: 0.5em;"><strong>BAB V : PENUTUP</strong><span class="toc-page">34</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">5.1 Kesimpulan<span class="toc-page">34</span></div>
      <div class="toc-row" style="padding-left: 1.25cm;">5.2 Saran<span class="toc-page">35</span></div>

      <div class="toc-row" style="margin-top: 0.5em;"><strong>DAFTAR PUSTAKA</strong><span class="toc-page">36</span></div>
      <div class="toc-row"><strong>LAMPIRAN</strong><span class="toc-page">38</span></div>
    </div>
  </div>

  <!-- HALAMAN 7: DAFTAR TABEL (Halaman vii) -->
  <div class="page-break">
    <div class="tajuk-tunggal">DAFTAR TABEL</div>
    <div style="font-size: 11pt; line-height: 1.3;">
      <div class="toc-row">Tabel 3.1 Kebutuhan Fungsional Sistem Platform AgriApp<span class="toc-page">15</span></div>
      <div class="toc-row">Tabel 3.2 Kamus Data Entitas User (Pengguna)<span class="toc-page">17</span></div>
      <div class="toc-row">Tabel 3.3 Kamus Data Entitas Product (Bahan Baku & Etalase Panen)<span class="toc-page">18</span></div>
      <div class="toc-row">Tabel 3.4 Kamus Data Entitas Order (Pesanan Induk)<span class="toc-page">18</span></div>
      <div class="toc-row">Tabel 3.5 Kamus Data Entitas OrderItem (Rincian Produk Pesanan)<span class="toc-page">19</span></div>
      <div class="toc-row">Tabel 3.6 Kamus Data Entitas Payment (Data Pembayaran)<span class="toc-page">19</span></div>
      <div class="toc-row">Tabel 3.7 Kamus Data Entitas Address (Alamat Pengiriman Restoran)<span class="toc-page">20</span></div>
      <div class="toc-row">Tabel 3.8 Kamus Data Entitas Review (Rating & Ulasan Mutu Komoditas)<span class="toc-page">20</span></div>
      <div class="toc-row">Tabel 3.9 Kamus Data Entitas Notification (Pemberitahuan Sistem)<span class="toc-page">20</span></div>
      <div class="toc-row">Tabel 4.1 Hasil Pengujian Black-Box Testing Sistem Platform AgriApp<span class="toc-page">29</span></div>
    </div>
  </div>

  <!-- HALAMAN 8: DAFTAR GAMBAR (Halaman viii) -->
  <div class="page-break">
    <div class="tajuk-tunggal">DAFTAR GAMBAR</div>
    <div style="font-size: 11pt; line-height: 1.3;">
      <div class="toc-row">Gambar 3.1 Diagram Alur Penyelesaian Tugas Akhir<span class="toc-page">14</span></div>
      <div class="toc-row">Gambar 3.2 Use Case Diagram Platform AgriApp<span class="toc-page">21</span></div>
      <div class="toc-row">Gambar 3.3 Entity Relationship Diagram (ERD) Basis Data AgriApp<span class="toc-page">22</span></div>
      <div class="toc-row">Gambar 3.4 Diagram Alir Transaksi Utama (End-to-End Supply Chain Flowchart)<span class="toc-page">23</span></div>
    </div>
  </div>

</body>
</html>`;
}

// Build HTML for Bagian Utama (Arabic pages 1 onwards)
function buildBagianUtamaHTML() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>

  <!-- ==================== BAB I : PENDAHULUAN ==================== -->
  <div class="tajuk-bab-container">
    <div class="petunjuk-bab">BAB I</div>
    <div class="tajuk-bab">PENDAHULUAN</div>
  </div>

  <div class="anak-bab">1.1 Latar Belakang</div>
  <p>Sektor pertanian memegang peranan yang sangat vital dalam struktur perekonomian Indonesia sebagai penghasil bahan pangan pokok dan penyumbang Produk Domestik Bruto (PDB) nasional (Annisa, 2023, hal. 39). Walaupun demikian, petani sebagai produsen primer komoditas pangan kerap kali berada dalam posisi tawar yang sangat lemah di dalam rantai pasok konvensional. Di berbagai daerah agraris, melimpahnya hasil panen tidak serta-merta berbanding lurus dengan peningkatan kesejahteraan petani karena panjangnya rantai distribusi pemasaran dari lahan tani hingga ke tangan konsumen akhir seperti pelaku usaha kuliner dan restoran (Hartati dkk., 2022, hal. 46).</p>
  
  <p>Dalam tata niaga konvensional, komoditas hasil panen harus melewati 4 hingga 6 tingkatan perantara perniagaan, mulai dari pedagang perantara desa (<span class="foreign">tengkulak</span>), pengepul kecamatan, pedagang besar pasar induk, hingga pedagang pengecer keliling. Keberadaan mata rantai yang berbelit-belit tersebut memicu timbulnya disparitas harga yang ekstrem. Berdasarkan kajian efisiensi distribusi komoditas hortikultura, selisih marjin harga antara tingkat petani produsen dan konsumen akhir di perkotaan dapat melonjak tajam mencapai 200% hingga 400% (Hendrawan dkk., 2024, hal. 1813). Sebagian besar keuntungan ekonomi terserap oleh spekulan perantara, sementara petani menanggung beban risiko gagal panen dan biaya pupuk yang terus meningkat.</p>
  
  <p>Kelemahan sistem manual dan konvensional yang berjalan pada saat ini mencakup beberapa faktor mendasar:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. <strong>Asimetri Informasi dan Ketiadaan Transparansi Harga:</strong> Petani di pedesaan memiliki keterbatasan akses untuk memantau fluktuasi harga komoditas dan tren permintaan riil pasar secara <span class="foreign">real-time</span>, sehingga penetapan harga beli di tingkat kebun ditentukan secara sepihak oleh pedagang pengumpul (Irwanto dkk., 2024, hal. 16).<br>
  2. <strong>Risiko Penurunan Mutu Produk Segar (<span class="foreign">Perishable Goods</span>):</strong> Komoditas sayuran dan buah-buahan rentan mengalami penurunan bobot dan pembusukan. Pola manual tidak menyediakan verifikasi mutu fisik dan bukti foto berbatas waktu kedaluwarsa secara digital, memicu friksi klaim kualitas saat barang tiba di tujuan (Hendrawan dkk., 2024, hal. 1814).<br>
  3. <strong>Pencatatan Transaksi Rentan Sengketa dan <span class="foreign">Race Condition</span>:</strong> Pesanan bahan baku oleh restoran seringkali dilakukan melalui panggilan telepon atau catatan nota fisik yang rawan hilang dan salah rekapitulasi, memicu perebutan kuantitas stok yang sama ketika beberapa restoran memesan secara simultan.<br>
  4. <strong>Fragmentasi Logistik dan Ketiadaan Pelacakan:</strong> Restoran yang memesan bahan dari banyak pemasok harus mengelola pengiriman secara terpisah tanpa kepastian armada kurir dan estimasi waktu sampai.</p>

  <p>Untuk memecahkan permasalahan struktural tersebut, penelitian Tugas Akhir ini merancang dan membangun platform digital rantai pasok agrikultur bernama <strong>AgriApp</strong>. Sistem ini mengintegrasikan tiga aktor utama ke dalam satu ekosistem terpadu: <strong>Petani</strong> selaku produsen panen, <strong>Toko Hub</strong> selaku agregator mutu dan pengelola logistik lokal, serta <strong>Restoran</strong> selaku konsumen komersial. Platform ini dikembangkan dengan arsitektur web modern berbasis <span class="foreign">Next.js 16 App Router</span>, <span class="foreign">React 19</span>, <span class="foreign">Prisma ORM</span>, dan <span class="foreign">PostgreSQL</span>, didukung mekanisme pemisahan pesanan otomatis multi-vendor (<span class="foreign">multi-vendor split order</span>) serta pengamanan berlapis berbasis <span class="foreign">Upstash Redis</span>.</p>

  <div class="anak-bab">1.2 Rumusan Masalah</div>
  <p>Berdasarkan latar belakang yang telah dipaparkan, rumusan masalah dalam penelitian Tugas Akhir ini adalah:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. Bagaimana merancang dan membangun arsitektur sistem informasi rantai pasok agrikultur berbasis web yang mengintegrasikan hak akses multi-peran (Petani, Hub, Restoran, dan Admin) secara aman menggunakan <span class="foreign">Role-Based Access Control</span> (RBAC)?<br>
  2. Bagaimana mengimplementasikan mekanisme transaksi digital yang mencakup pendaftaran hasil panen, kurasi verifikasi produk oleh Toko Hub, pemesanan multi-vendor dengan pemisahan pesanan otomatis (<span class="foreign">split order</span>), hingga pelacakan logistik kurir?<br>
  3. Bagaimana menerapkan mekanisme keamanan dan keandalan data pada sistem, meliputi inspeksi forensik biner gambar (<span class="foreign">magic bytes</span>), pembatasan laju kueri (<span class="foreign">rate limiting</span>) terdistribusi, serta <span class="foreign">state machine</span> transisi status pesanan guna mencegah manipulasi kuantitas dan <span class="foreign">bypass</span> alur transaksi?</p>

  <div class="anak-bab">1.3 Batasan Masalah</div>
  <p>Ruang lingkup dan batasan masalah pada proyek Tugas Akhir ini disesuaikan dengan kode sumber yang telah dibangun:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. <strong>Hak Akses Pengguna (<span class="foreign">Role</span>):</strong> Sistem membatasi hak akses pada empat peran spesifik: <span class="foreign">PETANI</span>, <span class="foreign">HUB</span>, <span class="foreign">RESTAURANT</span>, dan <span class="foreign">ADMIN</span> yang diverifikasi melalui token JWT pada lapisan <span class="foreign">Next.js Middleware</span>.<br>
  2. <strong>Ruang Lingkup Modul Fungsional:</strong><br>
     a. Modul Petani mencakup pendaftaran hasil panen, unggah foto bukti segar berdurasi kedaluwarsa 24 jam, pembaruan stok/harga modal, pengarsipan panen (<span class="foreign">soft delete</span> jika ada riwayat transaksi), dan dashboard metrik omzet penjualan.<br>
     b. Modul Toko Hub mencakup peninjauan panen petani, kurasi mutu, penetapan harga jual etalase toko (<span class="foreign">priceHub</span>), manajemen pengiriman kurir armada (nama pengemudi, kontak, plat nomor, estimasi tiba), dan manajemen status pesanan.<br>
     c. Modul Restoran mencakup penelusuran katalog bahan terverifikasi, pencarian instan, keranjang belanja persisten (<span class="foreign">localStorage</span>), checkout transaksi dengan pemecahan pesanan multi-vendor (<span class="foreign">split order</span>), simulasi pelunasan tagihan, konfirmasi penerimaan barang berfoto, dan ulasan rating bintang 1–5.<br>
     d. Modul Admin mencakup manajemen akun pengguna dan perubahan peran (<span class="foreign">role</span>).<br>
  3. <strong>Sistem Pembayaran:</strong> Transaksi pembayaran diselesaikan melalui modul simulasi internal (mendukung metode QRIS, Transfer Bank, dan E-Wallet) dan belum dihubungkan ke penyedia <span class="foreign">payment gateway</span> perbankan produksi pihak ketiga.<br>
  4. <strong>Teknologi Utama:</strong> Dibangun menggunakan <span class="foreign">Next.js 16</span> (App Router), <span class="foreign">React 19</span>, <span class="foreign">TypeScript 5</span>, basis data <span class="foreign">PostgreSQL</span> via <span class="foreign">Prisma ORM 5</span>, autentikasi <span class="foreign">NextAuth.js v4</span>, tata letak <span class="foreign">Tailwind CSS v4</span>, dan <span class="foreign">Upstash Redis</span>.<br>
  5. <strong>Penyimpanan Berkas Gambar:</strong> Foto disimpan langsung dalam basis data berformat <span class="foreign">Base64 Data URL</span> dengan batas ukuran 1.5 MB hingga 3 MB dan diverifikasi melalui biner <span class="foreign">magic bytes</span>.</p>

  <div class="anak-bab">1.4 Tujuan Tugas Akhir</div>
  <p>Tujuan yang hendak dicapai dalam pelaksanaan Tugas Akhir ini adalah:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. Merancang dan membangun platform digital rantai pasok agrikultur terpadu yang memfasilitasi interaksi aman dan transparan antara Petani, Toko Hub, dan Restoran menggunakan arsitektur web modern.<br>
  2. Mengimplementasikan modul transaksi belanja multi-vendor yang mampu melakukan pengelompokan item dan pemecahan nomor pesanan (<span class="foreign">split order</span>) secara atomik per Toko Hub penyedia barang guna mencegah kondisi balapan (<span class="foreign">race condition</span>) pada stok.<br>
  3. Menguji kehandalan fungsionalitas dan batas pertahanan keamanan sistem melalui pengujian <span class="foreign">Black-Box Testing</span>.</p>

  <div class="anak-bab">1.5 Manfaat Tugas Akhir</div>
  <p>Manfaat yang diharapkan dari hasil pembangunan aplikasi web ini mencakup:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. <strong>Bagi Petani:</strong> Membuka akses pasar yang luas tanpa ketergantungan pada pedagang spekulan, memberikan kepastian harga dasar, serta kemudahan mencatat omzet penjualan secara digital.<br>
  2. <strong>Bagi Toko Hub:</strong> Mempermudah kurasi mutu komoditas dari berbagai kelompok tani mitra, menstandarisasi pengelolaan stok etalase toko, serta menertibkan data pengiriman kurir.<br>
  3. <strong>Bagi Restoran:</strong> Memperoleh pasokan bahan segar terverifikasi dengan jaminan foto 24 jam, fleksibilitas membeli kebutuhan dapur dari banyak toko dalam satu keranjang belanja, serta transparansi pelacakan pengiriman.<br>
  4. <strong>Bagi Akademisi:</strong> Memberikan rujukan empiris penerapan arsitektur <span class="foreign">Full-Stack Next.js App Router</span> dan <span class="foreign">Prisma ORM</span> dalam memecahkan permasalahan integrasi rantai pasok secara <span class="foreign">type-safe</span> dan terstruktur.</p>

  <!-- ==================== BAB II : KAJIAN PUSTAKA ==================== -->
  <div class="page-break">
    <div class="tajuk-bab-container">
      <div class="petunjuk-bab">BAB II</div>
      <div class="tajuk-bab">KAJIAN PUSTAKA</div>
    </div>
  </div>

  <div class="anak-bab">2.1 Rantai Pasok Agrikultur (<span class="foreign">Agricultural Supply Chain</span>)</div>
  <p>Rantai pasok agrikultur merupakan serangkaian proses aliran fisik komoditas, aliran finansial, dan aliran informasi yang menghubungkan petani produsen dengan konsumen pengguna bahan pangan (Annisa, 2023, hal. 40). Menurut Hendrawan dkk. (2024, hal. 1814), komoditas pertanian memiliki karakteristik unik seperti rentan mengalami kerusakan fisik (<span class="foreign">perishability</span>), ketergantungan pada musim tanam, serta variasi mutu panen yang tidak seragam. Karakteristik ini menuntut adanya koordinasi yang sangat cepat dan transparan di antara setiap pemangku kepentingan.</p>
  <p>Pemanfaatan sistem informasi berbasis digital pada rantai pasok agrikultur terbukti mampu mereduksi perantara yang tidak efisien, meningkatkan integrasi informasi ketersediaan pasokan, serta mewujudkan keadilan harga bagi petani lokal (Hartati dkk., 2022, hal. 48). Dalam platform AgriApp, integrasi ini diwujudkan melalui kurasi Toko Hub yang bertindak sebagai pusat agregasi mutu sebelum komoditas didistribusikan ke restoran.</p>

  <div class="anak-bab">2.2 Sistem Informasi Berbasis Web</div>
  <p>Sistem informasi berbasis web merupakan aplikasi perangkat lunak yang beroperasi pada arsitektur klien-server menggunakan protokol standar HTTP/HTTPS (Irwanto dkk., 2024, hal. 18). Seiring perkembangan teknologi rekayasa web, arsitektur web telah bertransformasi dari pendekatan <span class="foreign">Multi-Page Application</span> (MPA) konvensional menuju pendekatan <span class="foreign">hybrid</span> yang memadukan kecepatan eksekusi <span class="foreign">Single Page Application</span> (SPA) dengan keandalan <span class="foreign">Server-Side Rendering</span> (SSR). Pola ini memberikan waktu respon antarmuka yang sangat cepat bagi pengguna sekaligus menjamin keamanan logika bisnis pada lapisan server (Ananda & Nama, 2024, hal. 354).</p>

  <div class="anak-bab">2.3 Kerangka Kerja Next.js dan <span class="foreign">Server Actions</span></div>
  <p><span class="foreign">Next.js</span> adalah kerangka kerja React tingkat produksi yang dikembangkan oleh Vercel. Pada versi 16, Next.js menggunakan arsitektur <span class="foreign">App Router</span> yang mengadopsi konsep <span class="foreign">React Server Components</span> (RSC). Inovasi utama yang dimanfaatkan dalam proyek ini adalah fitur <strong>Server Actions</strong>, yaitu fungsi-fungsi asinkron yang dieksekusi secara eksklusif di lingkungan server Node.js melalui deklarasi direktif <code>"use server"</code>. <span class="foreign">Server Actions</span> meniadakan kebutuhan penulisan endpoint REST API terpisah, meminimalisir kode <span class="foreign">boilerplate</span>, serta mendukung revalidasi cache instan melalui fungsi <code>revalidatePath()</code> sehingga data katalog dan pesanan selalu terbarui secara otomatis.</p>

  <div class="anak-bab">2.4 React dan TypeScript</div>
  <p><strong>React 19</strong> merupakan pustaka antarmuka deklaratif berbasis komponen modular yang mengelola pembaruan tampilan antarmuka secara reaktif melalui rekonsiliasi <span class="foreign">Virtual DOM</span>. Hal ini memungkinkan interaktivitas formulir pendaftaran panen dan keranjang belanja berjalan mulus tanpa memuat ulang seluruh halaman.</p>
  <p><strong>TypeScript 5</strong> adalah bahasa pemrograman bertipe statis yang dibangun di atas JavaScript. Penggunaan TypeScript menjamin konsistensi tipe data di seluruh lapisan sistem (mulai dari antarmuka klien, argumen Server Action, hingga entitas skema basis data), secara efektif mencegah kesalahan <span class="foreign">runtime</span> seperti ketidakcocokan tipe data dan kesalahan manipulasi nilai <span class="foreign">null</span>.</p>

  <div class="anak-bab">2.5 Prisma ORM dan PostgreSQL</div>
  <p><strong>Prisma ORM</strong> adalah lapisan pemetaan objek-relasional modern berbasis skema deklaratif (<code>schema.prisma</code>). Prisma menghasilkan pustaka klien yang bersifat <span class="foreign">type-safe</span> sesuai struktur tabel di basis data. Fitur transaksi interaktif (<code>prisma.$transaction</code>) dimanfaatkan dalam sistem ini untuk menegakkan prinsip ACID (<span class="foreign">Atomicity, Consistency, Isolation, Durability</span>) pada saat eksekusi checkout pesanan multi-vendor, sehingga pemotongan stok komoditas dan pembuatan tagihan pembayaran berlangsung secara utuh.</p>
  <p><strong>PostgreSQL</strong> digunakan sebagai sistem manajemen basis data relasional (<span class="foreign">RDBMS</span>) utama karena kehandalannya dalam menangani konkurensi data yang tinggi, integritas referensial kunci asing, serta pengindeksan unik pada nomor transaksi.</p>

  <div class="anak-bab">2.6 NextAuth.js dan Autentikasi JWT</div>
  <p><span class="foreign">NextAuth.js</span> digunakan untuk mengelola mekanisme autentikasi berbasis kredensial nama pengguna dan kata sandi. Sesi pengguna dikemas ke dalam <span class="foreign">JSON Web Token</span> (JWT) yang dienkripsi dan disimpan pada <span class="foreign">secure cookie</span> peramban. Token JWT tersebut membawa informasi identitas serta peran pengguna (<span class="foreign">role</span>), sehingga pengecekan hak akses pada lapisan <span class="foreign">middleware</span> dapat dilakukan secara <span class="foreign">stateless</span> tanpa melakukan kueri berulang ke basis data. Kata sandi pengguna diamankan menggunakan algoritma <span class="foreign">hashing</span> satu arah <span class="foreign">bcryptjs</span> dengan faktor keacakan <span class="foreign">salt</span>.</p>

  <div class="anak-bab">2.7 Tailwind CSS</div>
  <p><span class="foreign">Tailwind CSS v4</span> adalah kerangka kerja CSS berbasis <span class="foreign">utility-first</span> yang memungkinkan penyusunan tata letak antarmuka yang modern, bersih, dan adaptif langsung di dalam berkas komponen JSX/TSX. Seluruh komponen tampilan AgriApp dirancang responsif agar dapat diakses dengan nyaman baik melalui layar monitor komputer maupun perangkat telepon pintar di area perkebunan.</p>

  <div class="anak-bab">2.8 Upstash Redis dan <span class="foreign">Rate Limiting</span></div>
  <p><span class="foreign">Upstash Redis</span> adalah layanan basis data <span class="foreign">in-memory</span> berbasis arsitektur <span class="foreign">serverless</span> yang diakses melalui protokol REST HTTP. Sistem mengintegrasikan pustaka <code>@upstash/ratelimit</code> dengan algoritma <span class="foreign">Sliding Window</span> untuk membatasi frekuensi pemanggilan Server Action kritis (seperti pencegahan serangan <span class="foreign">spam</span> pendaftaran panen dan manipulasi checkout pesanan). Sistem juga dilengkapi mekanisme cadangan otomatis (<span class="foreign">in-memory fallback</span>) apabila koneksi jaringan ke Redis mengalami gangguan.</p>

  <div class="anak-bab">2.9 Telaah Penelitian Terdahulu Relevan (2022–2024)</div>
  <p>Guna memperkuat landasan teoretis, berikut ditelaah lima karya ilmiah terakreditasi terbitan 2022–2024 yang memiliki keterkaitan erat dengan penelitian Tugas Akhir ini:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. <strong>Hendrawan, Perwitasari, Wibowo, dan Fahriansyah (2024)</strong> dalam penelitian berjudul <em>"Pendekatan UML dalam Desain Sistem Informasi Rantai Pasok untuk Optimalisasi Produk Pertanian di Pertumbukan Wampu"</em> pada <em>Jurnal Minfo Polgan</em> (Vol. 13 No. 2, hal. 1812–1822, DOI: 10.33395/jmp.v13i2.14269). Penelitian ini merancang sistem rantai pasok produk pertanian menggunakan diagram UML untuk memantau aliran pasokan secara transparan antara petani, distributor, dan pengecer.<br>
  2. <strong>Irwanto, Nugroho, dan Fajri (2024)</strong> dalam artikel <em>"Aplikasi e-Marketplace Agribisnis Berbasis Website pada Desa Cucukan"</em> pada <em>JuTI (Jurnal Teknologi Informasi)</em> (Vol. 3 No. 1, hal. 15–24, DOI: 10.26798/juti.v3i1.1388). Penelitian ini membangun e-marketplace pertanian desa untuk memangkas rantai tengkulak dan meminimalisir disparitas harga jual komoditas agribisnis.<br>
  3. <strong>Hartati, Yapan, dan Nuryanti (2022)</strong> dalam penelitian berjudul <em>"E-Commerce Berbasis Marketplace Dalam Mempersingkat Penjualan Hasil Pertanian"</em> pada <em>JATSI (Jurnal Alih Teknologi Sistem Informasi)</em> (Vol. 3 No. 1, hal. 45–54, DOI: 10.57084/jatsi.v3i1.1176). Penelitian ini membuktikan bahwa platform digital mampu memperluas jangkauan pasar dan meningkatkan profitabilitas petani lokal melalui pemendekan saluran distribusi pemasaran.<br>
  4. <strong>Annisa (2023)</strong> dalam artikel <em>"Pemanfaatan Teknologi Informasi dan Komunikasi pada Pengembangan Rancangan Model Rantai Pasok pada Bidang Pertanian"</em> pada <em>Journal of Agribusiness Science and Rural Development (JASRD)</em> (Vol. 2 No. 2, hal. 38–46, DOI: 10.32639/jasrd.v2i2.366). Penelitian ini merumuskan model pertukaran informasi agribisnis berkelanjutan untuk mendasari perancangan aplikasi jual-beli produk pertanian.<br>
  5. <strong>Ananda dan Nama (2024)</strong> dalam penelitian <em>"Analisis Dan Perancangan Layanan Streaming Film Berbasis Web Langganan Menggunakan Framework Nextjs"</em> pada <em>Jurnal Informatika dan Teknik Elektro Terapan (JITET)</em> (Vol. 12 No. 1, hal. 352–364, DOI: 10.23960/jitet.v12i1.3967). Penelitian ini mengkaji penerapan kerangka kerja Next.js dalam membangun aplikasi web modern berkinerja tinggi serta teknik pengujian sistem menggunakan metode Black-Box Testing.</p>

  <!-- ==================== BAB III : METODE PENYELESAIAN TUGAS AKHIR ==================== -->
  <div class="page-break">
    <div class="tajuk-bab-container">
      <div class="petunjuk-bab">BAB III</div>
      <div class="tajuk-bab">METODE PENYELESAIAN TUGAS AKHIR</div>
    </div>
  </div>

  <div class="anak-bab">3.1 Alur Pelaksanaan Tugas Akhir</div>
  <p>Penyelesaian Tugas Akhir ini dilaksanakan melalui tahapan rekayasa perangkat lunak yang terstruktur, meliputi analisis masalah, perumusan kebutuhan fungsional dan keamanan, perancangan arsitektur dan skema basis data, implementasi kode sumber program, hingga tahap evaluasi pengujian <span class="foreign">Black-Box</span>. Alur penyelesaian tersebut diilustrasikan pada Gambar 3.1.</p>

  <div class="figure-container">
    <div class="figure-box">
[Tahap 1: Analisis Masalah Rantai Pasok]
                   │
                   ▼
[Tahap 2: Spesifikasi Kebutuhan & RBAC]
                   │
                   ▼
[Tahap 3: Perancangan Basis Data (Prisma ORM) & UML]
                   │
                   ▼
[Tahap 4: Implementasi Next.js 16 & Server Actions]
                   │
                   ▼
[Tahap 5: Pengujian Black-Box Testing & Validasi]
                   │
                   ▼
[Tahap 6: Dokumentasi Laporan Tugas Akhir]
    </div>
    <div class="figure-caption">Gambar 3.1 Alur Penyelesaian Masalah Tugas Akhir</div>
  </div>

  <p>Gambar 3.1 menunjukkan tahapan sistematis yang dilalui dalam perancangan dan pembangunan platform AgriApp hingga menghasilkan sistem yang teruji dan siap dioperasikan.</p>

  <div class="anak-bab">3.2 Analisis Kebutuhan Sistem</div>
  <p>Berdasarkan analisis alur proses bisnis rantai pasok agrikultur, dirumuskan kebutuhan fungsional perangkat lunak sebagaimana terangkum dalam Tabel 3.1.</p>

  <div class="table-container">
    <div class="table-title">Tabel 3.1 Kebutuhan Fungsional Sistem Platform AgriApp</div>
    <table>
      <thead>
        <tr>
          <th style="width: 12%;">Kode</th>
          <th style="width: 20%;">Modul / Aktor</th>
          <th>Deskripsi Kebutuhan Fungsional</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>FR-01</td>
          <td>Autentikasi</td>
          <td>Pengguna dapat mendaftarkan akun baru dengan validasi keunikan username dan email serta enkripsi password bcrypt.</td>
        </tr>
        <tr>
          <td>FR-02</td>
          <td>Autentikasi</td>
          <td>Pengguna dapat melakukan login dengan verifikasi sesi stateless berbasis JSON Web Token (JWT).</td>
        </tr>
        <tr>
          <td>FR-03</td>
          <td>Keamanan / RBAC</td>
          <td>Sistem membatasi hak akses rute URL dashboard secara otomatis sesuai peran: PETANI, HUB, RESTAURANT, dan ADMIN.</td>
        </tr>
        <tr>
          <td>FR-04</td>
          <td>Petani</td>
          <td>Petani dapat mendaftarkan panen baru (nama, stok, satuan, harga modal, dan foto bukti segar berdurasi 24 jam).</td>
        </tr>
        <tr>
          <td>FR-05</td>
          <td>Petani</td>
          <td>Sistem melakukan kompresi gambar di klien dan verifikasi forensik biner (magic bytes) di server.</td>
        </tr>
        <tr>
          <td>FR-06</td>
          <td>Petani</td>
          <td>Petani dapat mengedit data panen serta melakukan soft-delete stok jika komoditas telah memiliki riwayat pesanan.</td>
        </tr>
        <tr>
          <td>FR-07</td>
          <td>Toko Hub</td>
          <td>Hub dapat memeriksa antrean panen petani, memverifikasi kualitas fisik, dan menetapkan harga jual etalase (priceHub).</td>
        </tr>
        <tr>
          <td>FR-08</td>
          <td>Toko Hub</td>
          <td>Sistem mencegah klaim verifikasi ganda antar-Hub berbeda (anti-IDOR protection).</td>
        </tr>
        <tr>
          <td>FR-09</td>
          <td>Toko Hub</td>
          <td>Hub dapat memproses pesanan masuk, memverifikasi pelunasan bayar, dan memberangkatkan kurir armada pengiriman.</td>
        </tr>
        <tr>
          <td>FR-10</td>
          <td>Restoran</td>
          <td>Restoran dapat menelusuri katalog bahan segar terverifikasi dengan fitur pencarian teks instan.</td>
        </tr>
        <tr>
          <td>FR-11</td>
          <td>Restoran</td>
          <td>Restoran dapat mengelola keranjang belanja multi-vendor yang tersimpan secara persisten pada localStorage.</td>
        </tr>
        <tr>
          <td>FR-12</td>
          <td>Restoran</td>
          <td>Sistem secara otomatis memecah pesanan (Split Order) per Toko Hub pada saat checkout dalam transaksi atomik.</td>
        </tr>
        <tr>
          <td>FR-13</td>
          <td>Restoran</td>
          <td>Sistem memotong kuantitas stok produk secara atomik dengan proteksi kondisi balapan (stock: { gte: quantity }).</td>
        </tr>
        <tr>
          <td>FR-14</td>
          <td>Restoran</td>
          <td>Restoran dapat melakukan simulasi pelunasan pembayaran (QRIS, Transfer Bank, E-Wallet) dan mengelola alamat kirim.</td>
        </tr>
        <tr>
          <td>FR-15</td>
          <td>Restoran</td>
          <td>Restoran dapat mengonfirmasi penerimaan pesanan berstatus DIKIRIM disertai bukti foto berdurasi 24 jam.</td>
        </tr>
        <tr>
          <td>FR-16</td>
          <td>Restoran</td>
          <td>Restoran dapat memberikan ulasan rating bintang 1–5 pada produk yang pesanannya telah berstatus SELESAI.</td>
        </tr>
        <tr>
          <td>FR-17</td>
          <td>Admin</td>
          <td>Administrator dapat mengelola daftar pengguna, mengganti hak akses role, dan menghapus akun non-admin.</td>
        </tr>
        <tr>
          <td>FR-18</td>
          <td>Keamanan</td>
          <td>Sistem menerapkan pembatasan laju kueri (Rate Limiting) pada Server Actions kritis menggunakan Upstash Redis.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p>Tabel 3.1 mendefinisikan 18 spesifikasi kebutuhan fungsional inti yang diimplementasikan dalam kode program platform AgriApp guna menjamin kelancaran tata niaga agrikultur digital.</p>

  <div class="anak-bab">3.3 Perancangan Basis Data (<span class="foreign">Data Dictionary</span>)</div>
  <p>Struktur data disimpan dalam basis data relasional PostgreSQL yang dimodelkan melalui Prisma ORM. Kamus data dari seluruh delapan tabel disajikan pada Tabel 3.2 hingga Tabel 3.9.</p>

  <div class="table-container">
    <div class="table-title">Tabel 3.2 Kamus Data Entitas User (Pengguna)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer identitas unik pengguna</td></tr>
        <tr><td>name</td><td>String</td><td>Not Null</td><td>Nama lengkap atau nama badan usaha</td></tr>
        <tr><td>username</td><td>String</td><td>Unique, Not Null</td><td>Nama pengguna unik untuk login</td></tr>
        <tr><td>email</td><td>String</td><td>Unique, Nullable</td><td>Alamat surat elektronik pengguna</td></tr>
        <tr><td>password</td><td>String</td><td>Nullable</td><td>Kata sandi terenkripsi (hash bcrypt)</td></tr>
        <tr><td>role</td><td>Enum Role</td><td>Default PETANI</td><td>Nilai: PETANI, HUB, RESTAURANT, ADMIN</td></tr>
        <tr><td>createdAt</td><td>DateTime</td><td>Default now()</td><td>Waktu pendaftaran akun</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.3 Kamus Data Entitas Product (Bahan Baku & Etalase Panen)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer produk</td></tr>
        <tr><td>name</td><td>String</td><td>Not Null</td><td>Nama komoditas hasil panen</td></tr>
        <tr><td>description</td><td>String</td><td>Nullable</td><td>Catatan deskripsi mutu dari Toko Hub</td></tr>
        <tr><td>stock</td><td>Int</td><td>Not Null</td><td>Jumlah ketersediaan stok fisik</td></tr>
        <tr><td>unit</td><td>String</td><td>Not Null</td><td>Satuan komoditas (kg, ikat, ton, karung)</td></tr>
        <tr><td>priceFarmer</td><td>Int</td><td>Not Null</td><td>Harga modal/dasar dari petani (Rupiah)</td></tr>
        <tr><td>priceHub</td><td>Int</td><td>Nullable</td><td>Harga jual etalase Toko Hub ke Restoran</td></tr>
        <tr><td>isVerified</td><td>Boolean</td><td>Default false</td><td>Status lolos verifikasi mutu Toko Hub</td></tr>
        <tr><td>imageUrl</td><td>String (Text)</td><td>Nullable</td><td>Data URL berkas foto hasil panen (Base64)</td></tr>
        <tr><td>imageExpiresAt</td><td>DateTime</td><td>Nullable</td><td>Waktu kedaluwarsa foto panen (TTL 24 jam)</td></tr>
        <tr><td>userId</td><td>String</td><td>FK (User.id, Cascade)</td><td>Relasi akun Petani pemilik komoditas</td></tr>
        <tr><td>verifiedById</td><td>String</td><td>FK (User.id, SetNull)</td><td>Relasi akun Toko Hub pemverifikasi</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.4 Kamus Data Entitas Order (Pesanan Induk)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer pesanan</td></tr>
        <tr><td>orderNumber</td><td>String</td><td>Unique, Not Null</td><td>Nomor kode faktur pesanan transaksi</td></tr>
        <tr><td>status</td><td>Enum OrderStatus</td><td>Default MENUNGGU..</td><td>MENUNGGU_PEMBAYARAN, DIPROSES_HUB, DIKIRIM, SELESAI, DIBATALKAN</td></tr>
        <tr><td>totalAmount</td><td>Int</td><td>Not Null</td><td>Subtotal harga barang sebelum ongkir</td></tr>
        <tr><td>deliveryFee</td><td>Int</td><td>Default 0</td><td>Tarif ongkos kirim per Toko Hub</td></tr>
        <tr><td>finalAmount</td><td>Int</td><td>Not Null</td><td>Total tagihan bersih (totalAmount + deliveryFee)</td></tr>
        <tr><td>courierName</td><td>String</td><td>Nullable</td><td>Nama pengemudi kurir armada Hub</td></tr>
        <tr><td>courierPhone</td><td>String</td><td>Nullable</td><td>Nomor kontak kurir armada Hub</td></tr>
        <tr><td>vehicleNumber</td><td>String</td><td>Nullable</td><td>Nomor plat kendaraan kurir pengantar</td></tr>
        <tr><td>estimatedArrival</td><td>String</td><td>Nullable</td><td>Estimasi durasi waktu pengantaran</td></tr>
        <tr><td>receivedImageUrl</td><td>String (Text)</td><td>Nullable</td><td>Foto bukti serah terima barang di restoran</td></tr>
        <tr><td>receivedImageExpiresAt</td><td>DateTime</td><td>Nullable</td><td>Batas waktu kedaluwarsa bukti terima (24 jam)</td></tr>
        <tr><td>buyerId</td><td>String</td><td>FK (User.id, Restrict)</td><td>Relasi akun Restoran pemesan</td></tr>
        <tr><td>hubId</td><td>String</td><td>FK (User.id, Restrict)</td><td>Relasi akun Toko Hub pemroses barang</td></tr>
        <tr><td>addressId</td><td>String</td><td>FK (Address.id, SetNull)</td><td>Relasi alamat pengiriman restoran</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.5 Kamus Data Entitas OrderItem (Rincian Produk Pesanan)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer item pesanan</td></tr>
        <tr><td>quantity</td><td>Int</td><td>Not Null</td><td>Kuantitas produk yang dibeli</td></tr>
        <tr><td>pricePerUnit</td><td>Int</td><td>Not Null</td><td>Salinan harga satuan saat pesanan dibuat</td></tr>
        <tr><td>subtotal</td><td>Int</td><td>Not Null</td><td>Total biaya item (quantity * pricePerUnit)</td></tr>
        <tr><td>orderId</td><td>String</td><td>FK (Order.id, Cascade)</td><td>Relasi ke nomor pesanan induk</td></tr>
        <tr><td>productId</td><td>String</td><td>FK (Product.id, Restrict)</td><td>Relasi ke entitas komoditas produk</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.6 Kamus Data Entitas Payment (Data Pembayaran)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer data pembayaran</td></tr>
        <tr><td>amount</td><td>Int</td><td>Not Null</td><td>Nominal uang yang harus dilunasi</td></tr>
        <tr><td>method</td><td>Enum PaymentMethod</td><td>Default TRANSFER_BANK</td><td>Opsi: TRANSFER_BANK, E_WALLET, COD, QRIS</td></tr>
        <tr><td>status</td><td>Enum PaymentStatus</td><td>Default PENDING</td><td>Nilai: PENDING, LUNAS, GAGAL, REFUND</td></tr>
        <tr><td>paidAt</td><td>DateTime</td><td>Nullable</td><td>Waktu verifikasi pelunasan pembayaran</td></tr>
        <tr><td>orderId</td><td>String</td><td>FK (Order.id, Cascade), Unique</td><td>Relasi 1-to-1 dengan tabel Order</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.7 Kamus Data Entitas Address (Alamat Pengiriman Restoran)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer alamat</td></tr>
        <tr><td>label</td><td>String</td><td>Not Null</td><td>Label alamat (cth: Dapur Utama)</td></tr>
        <tr><td>recipientName</td><td>String</td><td>Not Null</td><td>Nama PIC penerima bahan baku</td></tr>
        <tr><td>phoneNumber</td><td>String</td><td>Not Null</td><td>Nomor WhatsApp penerima</td></tr>
        <tr><td>street</td><td>String</td><td>Not Null</td><td>Nama jalan dan nomor gedung</td></tr>
        <tr><td>city</td><td>String</td><td>Not Null</td><td>Nama kota atau kabupaten</td></tr>
        <tr><td>province</td><td>String</td><td>Not Null</td><td>Nama provinsi</td></tr>
        <tr><td>isPrimary</td><td>Boolean</td><td>Default false</td><td>Penanda alamat utama</td></tr>
        <tr><td>userId</td><td>String</td><td>FK (User.id, Cascade)</td><td>Relasi pemilik alamat (Restoran/Hub)</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.8 Kamus Data Entitas Review (Rating & Ulasan Mutu Komoditas)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer ulasan</td></tr>
        <tr><td>rating</td><td>Int</td><td>Not Null (1 s.d 5)</td><td>Skor kepuasan mutu komoditas</td></tr>
        <tr><td>comment</td><td>String</td><td>Nullable (Maks 500)</td><td>Ulasan catatan kesegaran bahan panen</td></tr>
        <tr><td>userId</td><td>String</td><td>FK (User.id, Cascade)</td><td>Relasi akun Restoran pemberi ulasan</td></tr>
        <tr><td>productId</td><td>String</td><td>FK (Product.id, Cascade)</td><td>Relasi komoditas yang diulas</td></tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <div class="table-title">Tabel 3.9 Kamus Data Entitas Notification (Pemberitahuan Sistem)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Nama Kolom</th>
          <th style="width: 20%;">Tipe Data</th>
          <th style="width: 25%;">Batasan (Constraint)</th>
          <th>Keterangan / Fungsi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>id</td><td>String (CUID)</td><td>PK, Default CUID</td><td>Kunci primer notifikasi</td></tr>
        <tr><td>title</td><td>String</td><td>Not Null</td><td>Judul ringkas pemberitahuan</td></tr>
        <tr><td>message</td><td>String</td><td>Not Null</td><td>Isi detail perubahan status pesanan</td></tr>
        <tr><td>type</td><td>Enum NotificationType</td><td>Default SISTEM</td><td>Jenis: PESANAN_BARU, STATUS_PESANAN, dll</td></tr>
        <tr><td>isRead</td><td>Boolean</td><td>Default false</td><td>Status penanda telah dibaca</td></tr>
        <tr><td>userId</td><td>String</td><td>FK (User.id, Cascade)</td><td>Relasi akun pengguna penerima</td></tr>
      </tbody>
    </table>
  </div>

  <div class="anak-bab">3.4 Perancangan Diagram Pemodelan Sistem</div>
  <p>Pemodelan fungsionalitas dan interaksi aktor diwujudkan melalui Use Case Diagram yang disajikan pada Gambar 3.2.</p>

  <div class="figure-container">
    <div class="figure-box">
  +---------------------------------------------------------------+
  |                      PLATFORM WEB AGRIAPP                     |
  |                                                               |
  |  (Petani)                                                     |
  |     ├── [UC-01: Registrasi Akun & Login Multi-Role]           |
  |     ├── [UC-02: Pendaftaran Hasil Panen & Foto 24 Jam]       |
  |     ├── [UC-03: Kelola Stok, Harga Modal & Arsip Panen]       |
  |     └── [UC-04: Monitoring Dashboard Metrik Penjualan]        |
  |                                                               |
  |  (Toko Hub)                                                   |
  |     ├── [UC-05: Kurasi Mutu & Penetapan Harga Etalase Hub]    |
  |     ├── [UC-06: Manajemen Stok Etalase Toko Mandiri]          |
  |     ├── [UC-07: Verifikasi Pelunasan Tagihan Pembayaran]      |
  |     └── [UC-08: Dispatch Pengiriman & Input Data Kurir]       |
  |                                                               |
  |  (Restoran)                                                   |
  |     ├── [UC-09: Eksplorasi Katalog Komoditas & Fitur Cari]    |
  |     ├── [UC-10: Checkout Multi-Vendor Split Order Atomik]     |
  |     ├── [UC-11: Simulasi Pelunasan Tagihan (QRIS/Transfer)]   |
  |     ├── [UC-12: Konfirmasi Penerimaan Barang & Foto Bukti]    |
  |     └── [UC-13: Penilaian Mutu Bahan & Rating Bintang 1-5]    |
  |                                                               |
  |  (Admin)                                                      |
  |     └── [UC-14: Manajemen Akun Pengguna & Otoritas Role]      |
  |                                                               |
  |  (System CRON Daemon)                                         |
  |     └── [UC-15: Pembersihan Otomatis Berkas Foto Expired]     |
  +---------------------------------------------------------------+
    </div>
    <div class="figure-caption">Gambar 3.2 Use Case Diagram Platform AgriApp</div>
  </div>

  <p>Gambar 3.2 memodelkan hak akses dan pemisahan tugas (*separation of duties*) antara aktor Petani, Toko Hub, Restoran, Admin, serta proses otomasi terjadwal sistem.</p>

  <p>Struktur hubungan antar-tabel dalam basis data relasional digambarkan melalui Entity Relationship Diagram (ERD) pada Gambar 3.3.</p>

  <div class="figure-container">
    <div class="figure-box">
  [USER] 1 ──────────── N [PRODUCT] (Menanam hasil panen)
    │ 1                      │ 1
    │                        │
    │ 1 ─────── N [ORDER]    │ N
    │ (Membuat/              │
    │  Memproses)            ▼
    │                   [ORDER_ITEM] N ─── 1 [ORDER]
    │                                          │ 1
    │ 1 ─────── N [ADDRESS]                    │
    │ (Memiliki)                               │ 1
    │                                          ▼
    │ 1 ─────── N [REVIEW]                 [PAYMENT]
    │ (Menulis)          ▲
    │                    │ N
    └────────────────────┴─── [PRODUCT] (Diulas)
    </div>
    <div class="figure-caption">Gambar 3.3 Entity Relationship Diagram (ERD) Basis Data AgriApp</div>
  </div>

  <p>Gambar 3.3 mengilustrasikan keterhubungan kardinalitas entitas basis data, di mana satu pesanan induk (<span class="foreign">Order</span>) mengikat banyak rincian barang (<span class="foreign">OrderItem</span>) dan tepat satu status pelunasan (<span class="foreign">Payment</span>).</p>

  <p>Alur transaksi operasional dari kebun petani hingga diterima di dapur restoran dirancang melalui diagram alir (<span class="foreign">flowchart</span>) pada Gambar 3.4.</p>

  <div class="figure-container">
    <div class="figure-box">
   (Mulai: Petani Input Panen & Foto Segar)
                      │
                      ▼
   [Sistem Catat Batas Kedaluwarsa Foto 24 Jam]
                      │
                      ▼
   [Toko Hub Memeriksa & Kurasi Mutu Fisik Barang]
                      │
             ┌────────┴────────┐
         (Lolos?)           (Tidak) ──► [Arsipkan Panen]
             │
            (Ya)
             │
             ▼
   [Hub Tetapkan priceHub & Produk Masuk Etalase]
                      │
                      ▼
   [Restoran Masukkan Komoditas Multi-Hub ke Keranjang]
                      │
                      ▼
   [Restoran Checkout: Sistem Split Order per Toko Hub]
                      │
                      ▼
   [Sistem Kunci & Potong Stok Secara Atomik (ACID)]
                      │
                      ▼
   [Restoran Lunasi Pembayaran (QRIS / Transfer Bank)]
                      │
                      ▼
   [Toko Hub Kemas Bahan & Input Informasi Kurir Armada]
                      │
                      ▼
   [Kurir Kirim Bahan ke Alamat Dapur Restoran]
                      │
                      ▼
   [Restoran Konfirmasi Penerimaan & Upload Foto Bukti]
                      │
                      ▼
   [Restoran Berikan Rating 1-5 & Ulasan Kesegaran]
                      │
                      ▼
                   (Selesai)
    </div>
    <div class="figure-caption">Gambar 3.4 Diagram Alir Transaksi Utama (End-to-End Supply Chain Flowchart)</div>
  </div>

  <p>Gambar 3.4 mendeskripsikan secara komprehensif alur transaksi mulai dari pendaftaran panen hingga tahap penyelesaian pesanan dan penerimaan bahan pangan di restoran.</p>

  <!-- ==================== BAB IV : HASIL DAN PEMBAHASAN ==================== -->
  <div class="page-break">
    <div class="tajuk-bab-container">
      <div class="petunjuk-bab">BAB IV</div>
      <div class="tajuk-bab">HASIL DAN PEMBAHASAN</div>
    </div>
  </div>

  <div class="anak-bab">4.1 Implementasi Antarmuka dan Kode Program Inti</div>
  <p>Implementasi platform AgriApp memisahkan antarmuka pengguna berbasis komponen klien (<span class="foreign">React Client Component</span>) dengan logika pemrosesan mutasi data server (<span class="foreign">Next.js Server Actions</span>). Penjelasan fungsionalitas halaman utama beserta potongan kode program inti diuraikan sebagai berikut:</p>

  <div class="sub-anak-bab">4.1.1 Pengamanan Kontrol Akses Berbasis Peran (<span class="foreign">Middleware RBAC</span>)</div>
  <p>Lapisan <code>middleware.ts</code> bertugas mencegat seluruh permintaan HTTP menuju rute terproteksi (<code>/petani/*</code>, <code>/hub/*</code>, <code>/restoran/*</code>, <code>/admin/*</code>). Token JWT diekstrak tanpa kueri basis data untuk memeriksa hak akses peran pengguna:</p>

  <pre class="code-block">
// middleware.ts - Penegakan Kontrol Akses Berbasis Peran (RBAC)
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  const isHttps = req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isHttps,
  });

  const role = token?.role;
  const isProtected = url.startsWith("/petani") || url.startsWith("/hub") || 
                      url.startsWith("/restoran") || url.startsWith("/admin");

  if (isProtected && !token) {
    return NextResponse.redirect(new URL(\`/login?callbackUrl=\${encodeURIComponent(url)}\`, req.url));
  }

  // Pengalihan ketat antar-peran (Role Isolation)
  if (url.startsWith("/petani") && role !== "PETANI") return NextResponse.redirect(new URL("/", req.url));
  if (url.startsWith("/hub") && role !== "HUB") return NextResponse.redirect(new URL("/", req.url));
  if (url.startsWith("/restoran") && role !== "RESTAURANT") return NextResponse.redirect(new URL("/", req.url));
  if (url.startsWith("/admin") && role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));

  return NextResponse.next();
}</pre>

  <div class="sub-anak-bab">4.1.2 Validasi Forensik Biner Berkas Gambar (<span class="foreign">Magic Bytes Inspection</span>)</div>
  <p>Untuk menanggulangi ancaman berkas berbahaya yang dimanipulasi ekstensinya (<span class="foreign">MIME-type spoofing</span>), sistem menerapkan verifikasi biner pada berkas <code>lib/file-validator.ts</code>:</p>

  <pre class="code-block">
// lib/file-validator.ts - Forensik Validasi Biner Tanda Tangan Gambar
export function validateImageBuffer(
  buffer: Buffer,
  maxSizeBytes: number = 2 * 1024 * 1024
): { isValid: boolean; detectedType?: string; error?: string } {
  if (buffer.length > maxSizeBytes) {
    return { isValid: false, error: \`Ukuran berkas melebihi batas \${(maxSizeBytes / 1024 / 1024).toFixed(1)}MB.\` };
  }

  // Pengecekan Magic Bytes: JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (RIFF....WEBP)
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  if (isJpeg) return { isValid: true, detectedType: "jpeg" };
  if (isPng)  return { isValid: true, detectedType: "png" };
  if (isWebp) return { isValid: true, detectedType: "webp" };

  return { isValid: false, error: "Berkas ditolak. Hanya format JPG, PNG, atau WebP yang sah." };
}</pre>

  <div class="sub-anak-bab">4.1.3 Transaksi Multi-Vendor <span class="foreign">Split Order</span> dan Pengurangan Stok Atomik</div>
  <p>Pada modul pemesanan restoran (<code>app/restoran/actions.ts</code>), sistem mengelompokkan item belanja berdasarkan Toko Hub pemilik komoditas dan memecah transaksi menjadi pesanan independen dalam satu transaksi atomik guna mencegah <span class="foreign">race condition</span>:</p>

  <pre class="code-block">
// app/restoran/actions.ts - Logika Pemecahan Pesanan Multi-Vendor Atomik
await prisma.$transaction(async (tx) => {
  let hubIndex = 1;
  for (const [hubId, hubItems] of itemsByHub.entries()) {
    const orderNumber = \`ORD-\${Date.now().toString().slice(-6)}-\${Math.floor(100 + Math.random() * 900)}\${itemsByHub.size > 1 ? \`-\${hubIndex++}\` : ""}\`;
    const deliveryFee = 15000;
    let totalAmount = 0;
    const orderItemsData = [];

    for (const { product, quantity } of hubItems) {
      const price = product.priceHub || product.priceFarmer;
      totalAmount += price * quantity;

      // Pengurangan stok bersyarat untuk mencegah Race Condition Stok Minus
      const updateResult = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });

      if (updateResult.count === 0) {
        throw new Error(\`STOK_HABIS:\${product.name}\`);
      }

      orderItemsData.push({ productId: product.id, quantity, pricePerUnit: price, subtotal: price * quantity });
    }

    const finalAmount = totalAmount + deliveryFee;

    // Pembentukan faktur pesanan independen per Toko Hub
    await tx.order.create({
      data: {
        orderNumber,
        buyerId: session.user.id,
        hubId,
        addressId: finalAddressId,
        totalAmount,
        deliveryFee,
        finalAmount,
        status: "MENUNGGU_PEMBAYARAN",
        items: { create: orderItemsData },
        payment: { create: { amount: finalAmount, method: paymentMethod, status: "PENDING" } },
      },
    });
  }
});</pre>

  <div class="sub-anak-bab">4.1.4 Penegakan <span class="foreign">State Machine</span> Alur Pesanan</div>
  <p>Pada modul pengelolaan pesanan Toko Hub (<code>app/hub/pesanan/actions.ts</code>), perubahan status pesanan dikawal secara ketat melalui matriks transisi yang sah guna mencegah pembatalan atau penyelesaian sepihak:</p>

  <pre class="code-block">
// app/hub/pesanan/actions.ts - Matriks Validasi Transisi Status Pesanan
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  MENUNGGU_PEMBAYARAN: [OrderStatus.DIPROSES_HUB, OrderStatus.DIBATALKAN],
  DIPROSES_HUB:        [OrderStatus.DIKIRIM, OrderStatus.DIBATALKAN],
  DIKIRIM:             [OrderStatus.SELESAI],
  SELESAI:             [], // Terminal State
  DIBATALKAN:          [], // Terminal State
};</pre>

  <div class="anak-bab">4.2 Pengujian Sistem (<span class="foreign">Black-Box Testing</span>)</div>
  <p>Pengujian sistem dilakukan menggunakan metode <span class="foreign">Black-Box Testing</span> dengan menguji respon antarmuka dan penolakan masukan tidak sah pada seluruh modul. Hasil pengujian dirangkum dalam Tabel 4.1.</p>

  <div class="table-container">
    <div class="table-title">Tabel 4.1 Hasil Pengujian Black-Box Testing Sistem Platform AgriApp</div>
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">No</th>
          <th style="width: 15%;">Modul / Halaman</th>
          <th style="width: 25%;">Skenario Pengujian</th>
          <th style="width: 25%;">Test Case (Input)</th>
          <th>Hasil yang Diharapkan</th>
          <th style="width: 10%;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Autentikasi</td>
          <td>Registrasi akun baru data valid</td>
          <td>Username unik, password valid, role PETANI</td>
          <td>Akun tersimpan, diarahkan ke login</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Autentikasi</td>
          <td>Registrasi username duplikat</td>
          <td>Username yang telah terdaftar</td>
          <td>Muncul pesan username sudah digunakan</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Autentikasi</td>
          <td>Login dengan password salah</td>
          <td>Username terdaftar, password salah</td>
          <td>Sistem menampilkan pesan kredensial keliru</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>4</td>
          <td>Autentikasi</td>
          <td>Login kredensial benar</td>
          <td>Username dan password valid</td>
          <td>Sesi JWT terbentuk, masuk ke dashboard</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>5</td>
          <td>Keamanan / RBAC</td>
          <td>Petani akses paksa URL Hub</td>
          <td>Akses URL manual /hub via address bar</td>
          <td>Dicegat middleware, dialihkan ke /</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>6</td>
          <td>Keamanan / RBAC</td>
          <td>Akses halaman tanpa sesi login</td>
          <td>Akses rute /restoran tanpa cookie login</td>
          <td>Dialihkan ke /login?callbackUrl=/restoran</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>7</td>
          <td>Petani</td>
          <td>Tambah komoditas data lengkap</td>
          <td>Nama: Tomat Ceri, Stok: 100, Harga: 15000</td>
          <td>Panen tersimpan (isVerified=false)</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>8</td>
          <td>Petani</td>
          <td>Tambah komoditas stok negatif</td>
          <td>Kuantitas stok: -20</td>
          <td>Ditolak dengan pesan stok tidak valid</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>9</td>
          <td>Petani</td>
          <td>Tambah komoditas harga nol/negatif</td>
          <td>Harga modal: 0 atau -1000</td>
          <td>Ditolak dengan pesan harga tidak valid</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>10</td>
          <td>Petani</td>
          <td>Unggah berkas ekstensi palsu</td>
          <td>Berkas skrip executable di-rename .jpg</td>
          <td>Ditolak oleh verifikasi magic bytes</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>11</td>
          <td>Petani</td>
          <td>Unggah foto resolusi tinggi 8MB</td>
          <td>Foto mentah kamera berukuran 8MB</td>
          <td>Dikompresi otomatis via Canvas (<1.5MB)</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>12</td>
          <td>Petani</td>
          <td>Hapus komoditas tanpa pesanan</td>
          <td>Hapus panen yang belum ada transaksi</td>
          <td>Data terhapus permanen dari basis data</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>13</td>
          <td>Petani</td>
          <td>Hapus komoditas berpembeli</td>
          <td>Hapus panen yang terdaftar di OrderItem</td>
          <td>Data diarsipkan (stok diset ke 0)</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>14</td>
          <td>Toko Hub</td>
          <td>Verifikasi panen harga wajar</td>
          <td>Input priceHub: 22000 pada antrean</td>
          <td>Status isVerified berubah menjadi true</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>15</td>
          <td>Toko Hub</td>
          <td>Klaim panen Hub lain (IDOR)</td>
          <td>Hub B mencoba verifikasi panen Hub A</td>
          <td>Ditolak: sudah diverifikasi toko lain</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>16</td>
          <td>Toko Hub</td>
          <td>Dispatch pengiriman kurir armada</td>
          <td>Input nama pengemudi kurir, telp, plat</td>
          <td>Status pesanan berubah menjadi DIKIRIM</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>17</td>
          <td>Toko Hub</td>
          <td>Bypass alur status pesanan</td>
          <td>Ubah status langsung Menunggu ke Selesai</td>
          <td>Ditolak oleh matriks validasi state machine</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>18</td>
          <td>Toko Hub</td>
          <td>Pembatalan pesanan diproses</td>
          <td>Batalkan order berstatus DIPROSES_HUB</td>
          <td>Status DIBATALKAN, stok dikembalikan</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>19</td>
          <td>Restoran</td>
          <td>Pencarian komoditas di katalog</td>
          <td>Ketik kata kunci: 'Cabai' pada search</td>
          <td>Menampilkan produk mengandung 'Cabai'</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>20</td>
          <td>Restoran</td>
          <td>Checkout belanja Multi-Hub</td>
          <td>Keranjang berisi komoditas 2 Hub berbeda</td>
          <td>Terbentuk 2 faktur pesanan terpisah</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>21</td>
          <td>Restoran</td>
          <td>Checkout melebihi stok fisik</td>
          <td>Pesan 200 kg pada komoditas sisa 50 kg</td>
          <td>Checkout dibatalkan, pesan stok habis</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>22</td>
          <td>Restoran</td>
          <td>Simulasi pelunasan QRIS</td>
          <td>Tekan tombol bayar simulasi pesanan</td>
          <td>Payment LUNAS, order jadi DIPROSES_HUB</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>23</td>
          <td>Restoran</td>
          <td>Konfirmasi penerimaan barang</td>
          <td>Unggah foto serah terima barang di dapur</td>
          <td>Status order SELESAI tercatat waktu terima</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>24</td>
          <td>Restoran</td>
          <td>Ulasan produk belum terbeli</td>
          <td>Kirim rating produk tanpa transaksi</td>
          <td>Ditolak: hanya boleh ulas produk terbeli</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>25</td>
          <td>Restoran</td>
          <td>Ulasan ganda pada produk sama</td>
          <td>Kirim ulasan kedua pada produk yang sama</td>
          <td>Ditolak: produk hanya dapat diulas 1 kali</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>26</td>
          <td>Admin</td>
          <td>Ganti peran akun pengguna lain</td>
          <td>Ubah role user dari PETANI ke HUB</td>
          <td>Role pengguna berhasil diperbarui</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>27</td>
          <td>Admin</td>
          <td>Hapus atau ganti role akun sendiri</td>
          <td>Admin mencoba menghapus akunnya sendiri</td>
          <td>Ditolak sistem demi integritas otoritas</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
        <tr>
          <td>28</td>
          <td>Keamanan</td>
          <td>Serangan spam checkout (Rate Limit)</td>
          <td>Kirim 15 kueri checkout secara beruntun</td>
          <td>Kueri ke-11 diblokir sementara (HTTP 429)</td>
          <td style="text-align: center; font-weight: bold;">Valid</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="anak-bab">4.3 Pembahasan Evaluasi Kinerja dan Keamanan Sistem</div>
  <p>Berdasarkan rekapitulasi pengujian pada Tabel 4.1, seluruh 28 skenario pengujian fungsional dan batas keamanan memperoleh status <strong>Valid (100%)</strong>. Hal ini membuktikan bahwa perancangan arsitektur sistem berhasil memenuhi seluruh spesifikasi kebutuhan fungsional (FR-01 s.d FR-18) yang telah ditetapkan pada Bab III.</p>
  <p>Dari perspektif integritas data, penerapan transaksi interaktif <code>prisma.$transaction</code> terbukti secara efektif mencegah anomali stok minus saat terjadi pemesanan multi-vendor secara simultan. Dari sisi keamanan aplikasi web, kombinasi inspeksi forensik biner <span class="foreign">magic bytes</span> dan pembatasan frekuensi kueri <span class="foreign">Upstash Redis</span> mampu melindungi sistem dari serangan injeksi berkas berbahaya dan penyalahgunaan <span class="foreign">bot</span> otomatis tanpa mengorbankan kecepatan waktu respon antarmuka pengguna.</p>

  <!-- ==================== BAB V : PENUTUP ==================== -->
  <div class="page-break">
    <div class="tajuk-bab-container">
      <div class="petunjuk-bab">BAB V</div>
      <div class="tajuk-bab">PENUTUP</div>
    </div>
  </div>

  <div class="anak-bab">5.1 Kesimpulan</div>
  <p>Berdasarkan rangkaian perancangan, implementasi, dan pengujian yang telah dilaksanakan pada penelitian Tugas Akhir ini, dapat ditarik beberapa kesimpulan utama:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. Berhasil dirancang dan dibangun platform digital rantai pasok agrikultur berbasis web (<strong>AgriApp</strong>) yang mengintegrasikan entitas Petani, Toko Hub, dan Restoran dalam satu ekosistem terpadu menggunakan kerangka kerja <span class="foreign">Next.js 16</span>, <span class="foreign">React 19</span>, <span class="foreign">Prisma ORM</span>, dan basis data <span class="foreign">PostgreSQL</span>.<br>
  2. Implementasi mekanisme pemecahan pesanan otomatis multi-vendor (<span class="foreign">multi-vendor split order</span>) yang dieksekusi secara atomik terbukti mampu mengelompokkan pesanan per Toko Hub secara akurat serta mengeliminasi risiko kondisi balapan (<span class="foreign">race condition</span>) pada pengurangan stok komoditas.<br>
  3. Penerapan sistem keamanan berlapis—meliputi kontrol akses peran (<span class="foreign">RBAC</span>), verifikasi forensik biner gambar (<span class="foreign">magic bytes</span>), pembatasan laju kueri (<span class="foreign">rate limiting</span>) via <span class="foreign">Upstash Redis</span>, serta penegakan matriks status pesanan (<span class="foreign">state machine</span>)—berhasil melindungi integritas sistem dari manipulasi transaksi dan akses tidak sah.<br>
  4. Pengujian fungsionalitas menggunakan metode <span class="foreign">Black-Box Testing</span> pada 28 skenario pengujian menghasilkan tingkat keberhasilan 100% valid, menunjukkan bahwa sistem beroperasi dengan stabil sesuai spesifikasi rancangan.</p>

  <div class="anak-bab">5.2 Saran</div>
  <p>Untuk pengembangan dan penyempurnaan platform AgriApp pada penelitian lanjutan, disarankan beberapa hal sebagai berikut:</p>
  <p class="no-indent" style="margin-left: 1.25cm;">1. Mengintegrasikan sistem pembayaran dengan penyedia gerbang pembayaran (<span class="foreign">payment gateway</span>) resmi di Indonesia seperti Midtrans atau Xendit melalui <span class="foreign">webhook</span> transaksi otomatis.<br>
  2. Mengembangkan modul pelacakan kurir secara <span class="foreign">real-time</span> berbasis geolokasi peta digital (<span class="foreign">Google Maps API</span> atau <span class="foreign">Leaflet</span>) guna meningkatkan visibilitas pergerakan armada pengantaran bahan pangan.<br>
  3. Memanfaatkan layanan penyimpanan awan terdistribusi (<span class="foreign">Cloud Object Storage</span> seperti AWS S3 atau Cloudflare R2) untuk menyimpan berkas foto panen dalam skala produksi massal guna mengoptimalkan kapasitas basis data utama.</p>

  <!-- ==================== DAFTAR PUSTAKA ==================== -->
  <div class="page-break">
    <div class="tajuk-tunggal">DAFTAR PUSTAKA</div>
    <div class="daftar-pustaka" style="font-size: 11pt;">
      <p>Ananda, R. A., & Nama, G. F. (2024). Analisis Dan Perancangan Layanan Streaming Film Berbasis Web Langganan Menggunakan Framework Nextjs. <em>Jurnal Informatika dan Teknik Elektro Terapan (JITET)</em>, 12(1), 352–364. https://doi.org/10.23960/jitet.v12i1.3967</p>
      
      <p>Annisa, L. H. (2023). Pemanfaatan Teknologi Informasi dan Komunikasi pada Pengembangan Rancangan Model Rantai Pasok pada Bidang Pertanian. <em>Journal of Agribusiness Science and Rural Development (JASRD)</em>, 2(2), 38–46. https://doi.org/10.32639/jasrd.v2i2.366</p>
      
      <p>Hartati, I., Yapan, U. F., & Nuryanti. (2022). E-Commerce Berbasis Marketplace Dalam Mempersingkat Penjualan Hasil Pertanian. <em>JATSI (Jurnal Alih Teknologi Sistem Informasi)</em>, 3(1), 45–54. https://doi.org/10.57084/jatsi.v3i1.1176</p>
      
      <p>Hendrawan, J., Perwitasari, I. D., Wibowo, F., & Fahriansyah. (2024). Pendekatan UML dalam Desain Sistem Informasi Rantai Pasok untuk Optimalisasi Produk Pertanian di Pertumbukan Wampu. <em>Jurnal Minfo Polgan</em>, 13(2), 1812–1822. https://doi.org/10.33395/jmp.v13i2.14269</p>
      
      <p>Irwanto, B., Nugroho, A., & Fajri, I. N. (2024). Aplikasi e-Marketplace Agribisnis Berbasis Website pada Desa Cucukan. <em>JuTI (Jurnal Teknologi Informasi)</em>, 3(1), 15–24. https://doi.org/10.26798/juti.v3i1.1388</p>
      
      <p>Prisma Data Inc. (2024). <em>Prisma Client Transactions & Concurrency Control</em>. https://www.prisma.io/docs</p>
      
      <p>Vercel Inc. (2024). <em>Next.js App Router and Server Actions Documentation</em>. https://nextjs.org/docs</p>
    </div>
  </div>

  <!-- ==================== LAMPIRAN ==================== -->
  <div class="page-break">
    <div class="tajuk-tunggal">LAMPIRAN</div>
    
    <div class="anak-bab" style="margin-top: 1cm;">Lampiran 1: Skema Model Data Prisma ORM (schema.prisma)</div>
    <pre class="code-block">
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  PETANI
  HUB
  RESTAURANT
  ADMIN
}

enum OrderStatus {
  MENUNGGU_PEMBAYARAN
  DIPROSES_HUB
  DIKIRIM
  SELESAI
  DIBATALKAN
}

enum PaymentMethod {
  TRANSFER_BANK
  E_WALLET
  COD
  QRIS
}

enum PaymentStatus {
  PENDING
  LUNAS
  GAGAL
  REFUND
}

enum NotificationType {
  PESANAN_BARU
  STATUS_PESANAN
  PANEN_TERVERIFIKASI
  STOK_HABIS
  SISTEM
}</pre>

    <div class="anak-bab" style="margin-top: 1.5cm;">Lampiran 2: Ringkasan Pengujian Kinerja dan Keamanan</div>
    <p>Pengujian laju kueri (<span class="foreign">rate limiting</span>) pada sistem diuji menggunakan 15 permintaan beruntun terhadap aksi pemesanan (<code>placeOrderAction</code>). Sistem terbukti membatasi eksekusi pada permintaan ke-11 dengan respon status HTTP 429 (<span class="foreign">Too Many Requests</span>) dan memberikan header penundaan <code>Retry-After: 60</code> detik.</p>
  </div>

</body>
</html>`;
}

async function renderPDF() {
  console.log('Menyiapkan berkas HTML...');
  const htmlAwal = buildBagianAwalHTML();
  const htmlUtama = buildBagianUtamaHTML();

  const fileAwalPath = path.join(__dirname, 'temp_awal.html');
  const fileUtamaPath = path.join(__dirname, 'temp_utama.html');

  fs.writeFileSync(fileAwalPath, htmlAwal, 'utf8');
  fs.writeFileSync(fileUtamaPath, htmlUtama, 'utf8');

  console.log('Meluncurkan headless browser Microsoft Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Mencetak Bagian Awal ke PDF...');
  await page.goto('file:///' + fileAwalPath.replace(/\\\\/g, '/'), { waitUntil: 'networkidle0' });
  const pdfAwalBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '4cm', left: '4cm', bottom: '3cm', right: '3cm' },
    printBackground: true
  });

  console.log('Mencetak Bagian Utama ke PDF...');
  await page.goto('file:///' + fileUtamaPath.replace(/\\\\/g, '/'), { waitUntil: 'networkidle0' });
  const pdfUtamaBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '4cm', left: '4cm', bottom: '3cm', right: '3cm' },
    printBackground: true
  });

  await browser.close();

  console.log('Melakukan penomoran halaman presisi dengan pdf-lib...');
  const finalPdfDoc = await PDFDocument.create();
  const fontTahoma = await finalPdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. Proses Bagian Awal (Angka Romawi kecil)
  // Aturan: Halaman judul bagian dalam (halaman 1) tidak diberi nomor urut halaman, tetapi diperhitungkan (halaman i).
  // Halaman berikutnya: ii, iii, iv, v, vi, vii, viii
  // Posisi nomor halaman bagian awal: lajur sebelah kanan, berjarak 1,5 cm dari margin atas (atau angka terakhir lurus margin kanan)
  const docAwal = await PDFDocument.load(pdfAwalBuffer);
  const pagesAwal = await finalPdfDoc.copyPages(docAwal, docAwal.getPageIndices());

  for (let idx = 0; idx < pagesAwal.length; idx++) {
    const p = pagesAwal[idx];
    const { width, height } = p.getSize();

    if (idx > 0) { // Lewatkan halaman 1 (cover)
      const romanNumber = toRoman(idx + 1); // idx 1 -> 'ii', idx 2 -> 'iii', dst.
      const textWidth = fontTahoma.widthOfTextAtSize(romanNumber, 10);
      
      // Lajur kanan lurus margin kanan (margin kanan 3cm = 3 * PT_PER_CM dari kanan)
      const x = width - (3 * PT_PER_CM) - textWidth;
      // Berjarak 1,5 cm dari margin atas (margin atas = 4cm, 1.5 cm di atas margin atas / dari tepi atas: height - 1.5cm)
      const y = height - (1.5 * PT_PER_CM);

      p.drawText(romanNumber, {
        x,
        y,
        size: 10,
        font: fontTahoma,
        color: rgb(0, 0, 0),
      });
    }
    finalPdfDoc.addPage(p);
  }

  // 2. Proses Bagian Utama (Angka Arab: 1, 2, 3...)
  // Aturan: Nomor halaman diletakkan pada bagian bawah sebelah kanan berjarak 1,5 cm dari margin bawah, angka terakhir lurus margin kanan teks
  const docUtama = await PDFDocument.load(pdfUtamaBuffer);
  const pagesUtama = await finalPdfDoc.copyPages(docUtama, docUtama.getPageIndices());

  for (let idx = 0; idx < pagesUtama.length; idx++) {
    const p = pagesUtama[idx];
    const { width, height } = p.getSize();
    const pageNumber = (idx + 1).toString();
    const textWidth = fontTahoma.widthOfTextAtSize(pageNumber, 10);

    // Kanan lurus dengan margin kanan teks (margin kanan 3cm)
    const x = width - (3 * PT_PER_CM) - textWidth;
    // Bagian bawah berjarak 1.5 cm dari tepi margin bawah
    const y = 1.5 * PT_PER_CM;

    p.drawText(pageNumber, {
      x,
      y,
      size: 10,
      font: fontTahoma,
      color: rgb(0, 0, 0),
    });

    finalPdfDoc.addPage(p);
  }

  const finalPdfBytes = await finalPdfDoc.save();
  const outputPath = path.join(__dirname, 'Naskah_Tugas_Akhir_AgriApp.pdf');
  fs.writeFileSync(outputPath, finalPdfBytes);

  // Bersihkan temporary files
  fs.unlinkSync(fileAwalPath);
  fs.unlinkSync(fileUtamaPath);

  console.log(`\n======================================================`);
  console.log(`BERHASIL! Berkas PDF Tugas Akhir telah selesai dibuat:`);
  console.log(`Lokasi: ${outputPath}`);
  console.log(`Jumlah Total Halaman: ${pagesAwal.length + pagesUtama.length} halaman`);
  console.log(`Ukuran Berkas: ${(finalPdfBytes.length / 1024).toFixed(1)} KB`);
  console.log(`======================================================\n`);
}

renderPDF().catch((err) => {
  console.error('Terjadi kesalahan:', err);
});
