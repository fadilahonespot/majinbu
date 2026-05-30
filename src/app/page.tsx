"use client";

import { useEffect, useState, useCallback } from "react";
import { FoodCandidateGrid, FoodResultCard } from "@/components/food";
import type {
  FoodCandidate,
  FoodCandidatesResponse,
  FoodDetailResponse,
} from "@/components/food/food.types";

function SparklesIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
      <path d="M4 20l3-3" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function ChefHatIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.47 5.47 0 0 1 9.18 0A4 4 0 0 1 18 13.87V16H6Z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function LoadingSpinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<FoodCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FoodDetailResponse | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId || !detail) return;
    if (detail.videoUrl) return;
    if (detail.videoStatus !== "PENDING" && detail.videoStatus !== "PROCESSING") return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-status?requestId=${encodeURIComponent(requestId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          videoAssetId: string | null;
          status: string | null;
          videoUrl: string | null;
        };
        if (cancelled) return;

        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            videoAssetId: data.videoAssetId,
            videoStatus: data.status,
            videoUrl: data.videoUrl,
          };
        });

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requestId, detail]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setDetail(null);
    setSelectedCandidateId(null);
    setCandidates([]);
    setRequestId(null);
    setLoadingCandidates(true);

    try {
      const res = await fetch("/api/food-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Gagal mengambil kandidat makanan");
      }

      const data = (await res.json()) as FoodCandidatesResponse;
      setRequestId(data.requestId);
      setCandidates(data.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoadingCandidates(false);
    }
  }, [prompt]);

  const handleSelectDetail = useCallback(async () => {
    if (!requestId || !selectedCandidateId) return;

    setLoadingDetail(true);
    setError(null);

    try {
      const res = await fetch("/api/food-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, prompt, selectedCandidateId }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Gagal mengambil detail makanan");
      }

      const data = (await res.json()) as FoodDetailResponse;
      setDetail(data);

      if ((data.videoStatus === "PENDING" || data.videoStatus === "PROCESSING") && !data.videoUrl) {
        void fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoadingDetail(false);
    }
  }, [requestId, selectedCandidateId, prompt]);

  const showCandidates = candidates.length > 0;
  const showDetail = !!detail;

  return (
    <div className="min-h-screen">
      <nav className="border-b border-orange-100/60 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍜</span>
            <span className="text-xl font-bold text-slate-800 tracking-tight">
              MajinBu
            </span>
          </div>
          <span className="text-sm text-slate-400">AI Food Inspiration</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <header className="text-center mb-10 md:mb-16 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <SparklesIcon />
            <span>AI-Powered Food Discovery</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-800 tracking-tight mb-4 leading-tight">
            Temukan Inspirasi
            <span className="text-orange-500 block md:inline"> Makanan</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
            Masukkan preferensi makananmu, dan biarkan AI menemukan rekomendasi
            lengkap dengan resep dan video.
          </p>
        </header>

        <section className="max-w-2xl mx-auto animate-fade-in-up animate-delay-100">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-orange-100/40 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                <ChefHatIcon />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Apa yang kamu inginkan?
                </h2>
                <p className="text-sm text-slate-400">
                  Ceritakan makanan impianmu
                </p>
              </div>
            </div>

            <PromptForm
              value={prompt}
              onChange={setPrompt}
              disabled={loadingCandidates || loadingDetail}
              loading={loadingCandidates}
              onSubmit={handleSubmit}
            />
          </div>
        </section>

        {error && (
          <section className="max-w-2xl mx-auto mt-6 animate-fade-in-up">
            <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-700 rounded-2xl p-5 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-500 text-sm font-bold">!</span>
              </div>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          </section>
        )}

        {showCandidates && (
          <section className="max-w-5xl mx-auto mt-10 md:mt-14 animate-fade-in-up">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-orange-100/40 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Pilih Kandidat Makanan
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Pilih salah satu untuk melihat detail lengkapnya
                  </p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                  {candidates.length} kandidat
                </span>
              </div>

              <FoodCandidateGrid
                candidates={candidates}
                selectedId={selectedCandidateId}
                onSelect={(c) => setSelectedCandidateId(c.id)}
              />

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-400">
                  {selectedCandidateId
                    ? "Klik tombol di samping untuk melihat detail"
                    : "Klik salah satu kandidat di atas"}
                </p>
                <button
                  type="button"
                  disabled={!selectedCandidateId || loadingDetail}
                  onClick={handleSelectDetail}
                  className="group inline-flex items-center bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white font-medium py-3 px-6 rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-orange-200/50 hover:shadow-orange-300/50 disabled:shadow-none"
                >
                  {loadingDetail ? (
                    <>
                      <LoadingSpinner className="w-5 h-5 mr-2" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      Lihat Detail
                      <ArrowRightIcon />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {showDetail && (
          <section className="max-w-4xl mx-auto mt-10 md:mt-14 animate-fade-in-up">
            <FoodResultCard detail={detail} />
          </section>
        )}
      </main>

      <footer className="border-t border-orange-100/40 bg-white/50 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-slate-400">
          <p className="flex items-center justify-center gap-2">
            <span>🍜</span>
            MajinBu — Dibuat dengan AI untuk pecinta kuliner Indonesia
          </p>
        </div>
      </footer>
    </div>
  );
}

function PromptForm(props: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  loading: boolean;
  onSubmit: () => Promise<void>;
}) {
  const { value, onChange, disabled, loading, onSubmit } = props;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      <div className="relative mb-4">
        <textarea
          id="prompt"
          name="prompt"
          rows={3}
          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none transition-all duration-200 text-sm md:text-base"
          placeholder="Contoh: makanan pedas gurih yang cocok dimakan malam hari"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <div className="absolute bottom-3 right-3 text-xs text-slate-300">
          {value.length}/500
        </div>
      </div>
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="group w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 text-white font-medium py-3.5 px-6 rounded-2xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Mencari...
          </>
        ) : (
          <>
            <SparklesIcon />
            Temukan Makanan
          </>
        )}
      </button>
    </form>
  );
}
