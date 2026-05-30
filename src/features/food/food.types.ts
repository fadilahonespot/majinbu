export interface FoodCandidate {
  id: string;
  candidateKey: string;
  namaMakanan: string;
  deskripsiSingkat: string;
  foodImageUrl: string | null;
  foodImageSource: string | null;
  foodImageMatchScore: number | null;
}

export interface FoodDetailData {
  namaMakanan: string;
  deskripsiDetail: string;
  karakterRasa: string[];
  tekstur: string;
  bahanUtama: string[];
  resepBahan: string[];
  langkahMemasak: string[];
  cocokUntuk: string;
  deskripsiVisual: string;
}

export interface VideoAssetData {
  videoPath: string | null;
  videoUrl: string | null;
  status: string;
}

export interface FoodCandidatesResponse {
  candidates: FoodCandidate[];
  requestId: string;
}

export interface FoodDetailResponse extends FoodDetailData {
  videoAssetId: string | null;
  videoUrl: string | null;
  videoStatus: string | null;
  videoErrorMessage: string | null;
  source: "cache" | "generated";
}
