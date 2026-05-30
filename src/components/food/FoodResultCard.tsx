"use client";
import type { FoodDetailResponse } from "@/components/food/food.types";

function ChefHatIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.47 5.47 0 0 1 9.18 0A4 4 0 0 1 18 13.87V16H6Z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

interface FoodResultCardProps {
  detail: FoodDetailResponse;
}

export function FoodResultCard({ detail }: FoodResultCardProps) {
  const videoFailed = detail.videoStatus === "FAILED";
  const videoReady = !!detail.videoUrl;
  const videoProcessing = detail.videoStatus === "PENDING" || detail.videoStatus === "PROCESSING";

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-orange-100/40 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 md:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <ChefHatIcon />
            </div>
            <span className="text-sm font-medium text-orange-100">
              Detail Makanan
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {detail.namaMakanan}
          </h2>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          <DetailSection title="Deskripsi" icon={null}>
            <p className="text-slate-600 leading-relaxed">
              {detail.deskripsiDetail}
            </p>
          </DetailSection>

          <div className="grid md:grid-cols-2 gap-6">
            <DetailSection title="Karakter Rasa" icon={null}>
              <div className="flex flex-wrap gap-2">
                {detail.karakterRasa.map((rasa) => (
                  <span
                    key={rasa}
                    className="bg-orange-50 text-orange-700 text-sm font-medium px-3 py-1.5 rounded-xl border border-orange-100"
                  >
                    {rasa}
                  </span>
                ))}
              </div>
            </DetailSection>

            <DetailSection title="Tekstur" icon={null}>
              <p className="text-slate-600">{detail.tekstur}</p>
            </DetailSection>
          </div>

          <DetailSection title="Bahan Utama" icon={null}>
            <div className="flex flex-wrap gap-2">
              {detail.bahanUtama.map((bahan) => (
                <span
                  key={bahan}
                  className="bg-slate-50 text-slate-700 text-sm px-3 py-1.5 rounded-xl border border-slate-200"
                >
                  {bahan}
                </span>
              ))}
            </div>
          </DetailSection>

          <DetailSection title="Bahan - Bahan Resep" icon={null}>
            <ul className="space-y-2">
              {detail.resepBahan.map((bahan, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm">{bahan}</span>
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection title="Langkah Memasak" icon={null}>
            <ol className="space-y-4">
              {detail.langkahMemasak.map((langkah, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pt-1">
                    {langkah}
                  </p>
                </li>
              ))}
            </ol>
          </DetailSection>

          <DetailSection title="Cocok Untuk" icon={null}>
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-sm font-medium px-4 py-2 rounded-xl border border-orange-100">
              <ClockIcon />
              {detail.cocokUntuk}
            </div>
          </DetailSection>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-orange-100/40 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 md:px-8 py-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Video Tutorial
          </h3>
        </div>
        <div className="p-6 md:p-8">
          {videoFailed && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 text-sm flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-500 text-sm font-bold">!</span>
              </div>
              <div>
                <p className="font-medium mb-1">Video gagal dibuat</p>
                <p className="text-red-600/70">{detail.videoErrorMessage ?? "Terjadi kesalahan saat generating video"}</p>
              </div>
            </div>
          )}
          {videoProcessing && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 rounded-2xl p-5 text-sm flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Video sedang dibuat...</span>
              </div>
            </div>
          )}
          {videoReady && (
            <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden">
              <video
                src={detail.videoUrl!}
                controls
                className="w-full h-full object-contain bg-black"
                poster={detail.deskripsiVisual ? undefined : undefined}
              >
                Browser tidak mendukung video player.
              </video>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}
