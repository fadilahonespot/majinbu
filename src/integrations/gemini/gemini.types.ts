export interface GeminiCandidate {
  id: string;
  nama_makanan: string;
  deskripsi_singkat: string;
}

export interface GeminiDetailResult {
  nama_makanan: string;
  deskripsi_detail: string;
  karakter_rasa: string[];
  tekstur: string;
  bahan_utama: string[];
  resep_bahan: string[];
  langkah_memasak: string[];
  cocok_untuk: string;
  deskripsi_visual: string;
}

export interface GeminiCandidatesResult {
  candidates: GeminiCandidate[];
}
