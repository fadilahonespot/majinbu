export interface PexelsImageResult {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  width: number;
  height: number;
  alt: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

export interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsImageResult[];
}
