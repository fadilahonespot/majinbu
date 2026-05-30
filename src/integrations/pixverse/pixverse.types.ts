export interface PixVerseCreateResponse {
  job_id: string;
  status: string;
}

export interface PixVerseStatusResponse {
  job_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  video_url?: string;
  error?: string;
}
