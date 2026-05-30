# Implementation Plan

Dokumen ini berisi rencana implementasi untuk sistem `AI Food Inspiration` berbasis prompt, integrasi AI, kandidat makanan, sinkronisasi gambar via `Pexels`, detail makanan, resep cara membuat, dan generasi video untuk kebutuhan MVP/testing.

## Tujuan Implementasi

Membangun sistem yang dapat:

- menerima prompt makanan dari user
- memproses prompt dengan AI menjadi daftar kandidat makanan
- menampilkan kandidat makanan beserta gambar untuk dipilih user
- memproses pilihan user menjadi detail makanan yang lebih kaya
- menampilkan resep bahan dan langkah memasak ke user
- mengecek cache video yang sudah pernah dibuat
- membuat video baru jika data belum tersedia
- menampilkan detail makanan dan video hasil generate

## Scope MVP

Fitur yang masuk pada tahap awal:

- input prompt makanan
- daftar kandidat makanan bergambar
- integrasi Gemini AI
- cache check ke database
- integrasi PixVerse untuk generate video
- penyimpanan metadata dan path video
- tampilan detail makanan, resep, dan video

Fitur yang belum wajib pada MVP:

- autentikasi user
- dashboard admin
- analytics lanjutan
- queue system terpisah
- favorit dan riwayat pencarian

## Arsitektur Implementasi

Komponen utama:

- `Frontend`: form input, daftar kandidat makanan, halaman hasil, video player, section resep
- `Backend API`: orchestration request, validasi data, integrasi service
- `Gemini AI`: ekstraksi prompt menjadi kandidat makanan dan detail terstruktur
- `Pexels API`: pencarian gambar kandidat makanan
- `PixVerse API`: generasi video dari deskripsi visual
- `PostgreSQL`: database utama untuk metadata makanan, video, dan request log
- `Storage`: penyimpanan file video

## Tahapan Implementasi

### Ringkasan Fase

1. `Fase 1 - Setup`: siapkan fondasi project dan environment
2. `Fase 2 - Input & Endpoint`: bangun alur input prompt dan endpoint dasar
3. `Fase 3 - Kandidat & Gambar`: hasilkan maksimal 6 kandidat makanan dan lengkapi gambarnya
4. `Fase 4 - Detail Makanan`: hasilkan detail makanan dan resep
5. `Fase 5 - Database & Cache`: simpan metadata dan hindari generate ulang
6. `Fase 6 - PixVerse`: generate dan simpan video makanan
7. `Fase 7 - UI Hasil`: tampilkan detail makanan, resep, dan video
8. `Fase 8 - Error Handling`: tambah loading state, fallback, dan logging
9. `Fase 9 - Testing`: validasi alur end-to-end MVP

### Fase 1: Setup Project

**Tujuan**

- menyiapkan struktur project frontend dan backend
- menyiapkan environment variable
- menyiapkan koneksi database

**Task utama**

- buat struktur folder project
- siapkan file `.env`
- definisikan konfigurasi API key
- setup `PostgreSQL` lokal atau cloud
- tentukan lokasi penyimpanan video sementara

**Deliverable**

- project bisa dijalankan secara lokal
- backend bisa terkoneksi ke `PostgreSQL`
- konfigurasi environment sudah siap dipakai

### Fase 2: Implementasi Input dan Endpoint Dasar

**Tujuan**

- frontend dapat mengirim prompt ke backend
- backend memiliki endpoint untuk mengambil kandidat makanan
- backend memiliki endpoint lanjutan untuk memproses pilihan user

**Task frontend**

- buat form input prompt
- buat tombol submit
- tampilkan state loading
- siapkan tampilan card kandidat makanan

**Task backend**

- buat endpoint `POST /api/food-candidates`
- buat endpoint `POST /api/food-detail`
- validasi field `prompt`
- buat response schema awal

**Contoh request**

```json
{
  "prompt": "makanan gurih pedas yang cocok dimakan malam hari"
}
```

**Deliverable**

- user dapat submit prompt
- backend menerima request dengan format yang valid
- endpoint dasar siap dipakai untuk integrasi AI

### Fase 3: Kandidat Makanan dan Gambar

**Tujuan**

- backend dapat mengubah prompt user menjadi daftar kandidat makanan
- setiap kandidat makanan memiliki gambar yang bisa ditampilkan di frontend

**Task utama**

- integrasikan request ke Gemini AI
- buat prompt template untuk kandidat makanan
- validasi output JSON kandidat dari Gemini
- batasi hasil kandidat Gemini menjadi maksimal 6 item
- siapkan service pencarian gambar ke `Pexels` berdasarkan `nama_makanan`
- ambil 3 sampai 5 hasil gambar per kandidat untuk proses matching
- hitung skor kecocokan gambar untuk tiap kandidat
- pilih satu gambar terbaik untuk tiap kandidat
- gunakan fallback ke placeholder image jika gambar tidak ditemukan
- simpan `image_url` final untuk tiap kandidat

**Field minimal hasil kandidat**

- `id`
- `nama_makanan`
- `deskripsi_singkat`
- `image_url`
- `image_source`
- `image_match_score`

**Deliverable**

- kandidat makanan berhasil muncul dari prompt user
- setiap kandidat tampil dengan gambar yang valid
- hanya kandidat terpilih yang diproses ke tahap detail, resep, dan video

### Fase 4: Integrasi Gemini AI untuk Detail

**Tujuan**

- backend dapat mengubah makanan terpilih menjadi data terstruktur detail

**Task utama**

- buat prompt template untuk detail makanan
- validasi output JSON detail dari Gemini
- tangani error jika output tidak lengkap atau format salah

**Field minimal hasil detail**

- `nama_makanan`
- `deskripsi_detail`
- `karakter_rasa`
- `tekstur`
- `bahan_utama`
- `resep_bahan`
- `langkah_memasak`
- `cocok_untuk`
- `deskripsi_visual`

**Deliverable**

- detail makanan dan resep berhasil dihasilkan setelah user memilih kandidat

### Fase 5: Implementasi Database dan Cache Check

**Tujuan**

- sistem dapat menyimpan metadata makanan dan mengecek apakah video sudah tersedia

**Task utama**

- buat tabel metadata
- siapkan field untuk `food_image_url`
- siapkan field untuk `food_image_match_score`
- simpan hasil Gemini yang sudah tervalidasi
- query berdasarkan `nama_makanan` dan `prompt_hash`
- kembalikan video jika data sudah ada

**Contoh tabel MVP**

```sql
CREATE TABLE food_videos (
  id SERIAL PRIMARY KEY,
  nama_makanan VARCHAR(255) NOT NULL,
  food_image_url TEXT,
  food_image_source VARCHAR(100),
  food_image_match_score INT,
  deskripsi_detail TEXT,
  karakter_rasa TEXT,
  tekstur VARCHAR(255),
  bahan_utama TEXT,
  resep_bahan TEXT,
  langkah_memasak TEXT,
  cocok_untuk VARCHAR(255),
  deskripsi_visual TEXT NOT NULL,
  prompt_hash VARCHAR(255) NOT NULL,
  video_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Catatan implementasi:

- untuk MVP, field seperti `karakter_rasa`, `bahan_utama`, `resep_bahan`, dan `langkah_memasak` disarankan menggunakan `JSONB` di `PostgreSQL`
- jika kebutuhan query makin kompleks, field tersebut bisa dipisah ke tabel relasional pada fase berikutnya

**Deliverable**

- metadata makanan dan resep tersimpan di database
- sistem dapat membedakan `cache hit` dan `cache miss`

### Fase 6: Integrasi PixVerse

**Tujuan**

- sistem dapat membuat video baru jika cache tidak tersedia

**Task utama**

- kirim `deskripsi_visual` ke PixVerse
- simpan `job_id`
- lakukan polling status
- unduh hasil video jika selesai
- simpan video ke storage lokal atau cloud

**Deliverable**

- `video_path` atau `video_url` tersimpan dan bisa diakses frontend
- video tidak digenerate ulang untuk request yang sama bila cache tersedia

### Fase 7: Implementasi Halaman Hasil

**Tujuan**

- user dapat memilih kandidat makanan lalu melihat hasil akhir

**Task frontend**

- tampilkan daftar kandidat makanan
- tampilkan gambar tiap kandidat
- tampilkan state makanan terpilih
- tampilkan nama makanan
- tampilkan deskripsi detail
- tampilkan karakter rasa
- tampilkan tekstur
- tampilkan bahan utama
- tampilkan resep bahan
- tampilkan langkah memasak
- tampilkan momen yang cocok
- tampilkan video player

**Komponen yang dibutuhkan**

- candidate card list
- candidate image card
- result card
- flavor tags
- recipe section
- video section

**Deliverable**

- halaman hasil menampilkan informasi makanan secara lengkap
- user dapat membaca resep dan memutar video dalam satu alur

### Fase 8: Error Handling dan Loading State

**Tujuan**

- sistem tetap usable saat proses AI atau video generation lambat/gagal

**Task utama**

- tampilkan loading saat request sedang diproses
- tampilkan status `video sedang dibuat` jika render lama
- tampilkan fallback message jika data gagal diambil
- log error dari Gemini dan PixVerse

**Deliverable**

- user mendapat feedback status proses
- error mudah dilacak dari sisi backend

### Fase 9: Testing MVP

**Tujuan**

- memastikan alur dasar berjalan end-to-end

**Checklist testing**

- input prompt valid berhasil diproses
- response Gemini untuk kandidat sesuai format
- kandidat makanan tampil lengkap dengan gambar
- maksimal 6 kandidat tampil di frontend
- fallback image tampil jika gambar kandidat utama tidak tersedia
- user dapat memilih salah satu kandidat
- response Gemini untuk detail sesuai format
- resep bahan tampil dengan benar
- langkah memasak tampil berurutan
- cache hit mengembalikan video lama
- cache miss memicu generate video baru
- video dapat diputar di frontend

**Deliverable**

- alur MVP tervalidasi dari input sampai hasil akhir
- daftar bug utama untuk perbaikan sebelum lanjut fase berikutnya

## Urutan Implementasi yang Disarankan

Urutan kerja paling efisien:

1. setup project dan environment
2. buat endpoint backend dasar
3. integrasi Gemini AI untuk kandidat makanan
4. integrasi Pexels untuk gambar kandidat makanan
5. buat form frontend dan daftar kandidat
6. integrasi Gemini AI untuk detail pilihan user
7. setup database dan cache check
8. integrasi PixVerse
9. tampilkan hasil di frontend
10. tambahkan loading, error handling, dan logging

## Struktur Endpoint MVP

Endpoint yang disarankan:

- `POST /api/food-candidates`
- `POST /api/food-detail`
- `GET /api/video/:id`
- `GET /api/health`

Contoh response `POST /api/food-candidates`:

```json
{
  "candidates": [
    {
      "id": "food-1",
      "nama_makanan": "Seblak",
      "deskripsi_singkat": "Makanan pedas gurih berkuah dengan topping beragam",
      "image_url": "https://images.pexels.com/...",
      "image_source": "pexels",
      "image_match_score": 82
    }
  ]
}
```

Contoh request `POST /api/food-detail`:

```json
{
  "prompt": "makanan gurih pedas yang cocok dimakan malam hari",
  "selected_food_id": "food-1",
  "selected_food_name": "Seblak"
}
```

Contoh response `POST /api/food-detail`:

```json
{
  "nama_makanan": "Seblak",
  "deskripsi_detail": "Seblak adalah makanan khas dengan cita rasa gurih pedas, tekstur kenyal, dan aroma kencur yang kuat.",
  "karakter_rasa": ["gurih", "pedas"],
  "tekstur": "kenyal dan berkuah",
  "bahan_utama": ["kerupuk", "cabai", "kencur", "telur"],
  "resep_bahan": [
    "100 gram kerupuk bawang",
    "2 butir telur",
    "5 cabai rawit",
    "2 siung bawang putih",
    "1 ruas kencur"
  ],
  "langkah_memasak": [
    "Rendam kerupuk hingga sedikit lunak.",
    "Haluskan cabai, bawang putih, dan kencur.",
    "Tumis bumbu halus hingga harum.",
    "Masukkan telur lalu orak-arik.",
    "Tambahkan air dan kerupuk, lalu masak hingga kuah meresap."
  ],
  "cocok_untuk": "makan malam atau saat cuaca dingin",
  "video_url": "/videos/seblak-abc123xyz.mp4",
  "source": "cache"
}
```

## Kebutuhan Environment Variable

Contoh variabel:

```env
GEMINI_API_KEY=your_gemini_api_key
PIXVERSE_API_KEY=your_pixverse_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/majinbu
VIDEO_STORAGE_PATH=./storage/videos
```

## Risiko Implementasi

- output Gemini tidak selalu konsisten
- hasil kandidat makanan dan gambar bisa kurang relevan dengan prompt
- sumber gambar kandidat bisa tidak konsisten jika memakai banyak fallback
- makanan lokal tertentu mungkin sulit ditemukan gambar yang cocok di Pexels
- proses generate video memerlukan waktu cukup lama
- detail makanan bisa terlalu generik jika prompt user kurang spesifik
- langkah resep dari AI perlu divalidasi agar tetap masuk akal untuk user

## Rekomendasi Teknis

- gunakan schema validation untuk response AI
- batasi jumlah kandidat makanan menjadi maksimal 6 item
- gunakan `Pexels` sebagai source utama gambar kandidat
- gunakan `PostgreSQL` sebagai database utama
- gunakan `JSONB` untuk array dan data resep pada MVP agar development lebih cepat
- lakukan scoring sederhana untuk memilih gambar kandidat terbaik
- simpan hasil generate agar tidak mengulang biaya
- gunakan slug atau hash untuk cache key jika sistem mulai berkembang
- pisahkan logic integrasi provider ke service layer
- tambahkan request logging sejak awal

## Deliverable Tahap Awal

Deliverable minimum:

- frontend input prompt
- frontend menampilkan kandidat makanan bergambar
- user dapat memilih kandidat makanan
- backend endpoint food candidates
- backend endpoint food detail
- integrasi Gemini AI berjalan
- integrasi Pexels untuk gambar kandidat berjalan
- cache check ke database berjalan
- generate video via PixVerse berjalan
- hasil lengkap beserta resep tampil di halaman frontend

## Next Step Setelah MVP

- tambahkan queue untuk proses video async
- tambahkan filter kategori makanan atau mood makanan
- tambahkan fitur favorit dan riwayat pencarian
- tambahkan dashboard monitoring request dan biaya API
