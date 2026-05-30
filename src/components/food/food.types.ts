export interface FoodCandidate {
  id: string;
  candidateKey: string;
  namaMakanan: string;
  deskripsiSingkat: string;
  foodImageUrl: string | null;
  foodImageSource: string | null;
  foodImageMatchScore: number | null;
}

export interface FoodCandidatesResponse {
  candidates: FoodCandidate[];
  requestId: string;
}

export interface FoodDetailResponse {
  namaMakanan: string;
  deskripsiDetail: string;
  karakterRasa: string[];
  tekstur: string;
  bahanUtama: string[];
  resepBahan: string[];
  langkahMemasak: string[];
  cocokUntuk: string;
  deskripsiVisual: string;
  videoAssetId: string | null;
  videoUrl: string | null;
  videoStatus: string | null;
  videoErrorMessage: string | null;
  source: "cache" | "generated";
}
