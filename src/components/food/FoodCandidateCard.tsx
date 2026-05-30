"use client";
import { useState, useMemo } from "react";
import type { FoodCandidate } from "@/components/food/food.types";

function getProxyUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface FoodCandidateCardProps {
  candidate: FoodCandidate;
  onSelect: (candidate: FoodCandidate) => void;
  isSelected: boolean;
}

export function FoodCandidateCard({
  candidate,
  onSelect,
  isSelected,
}: FoodCandidateCardProps) {
  const [imageError, setImageError] = useState(false);

  const proxiedUrl = useMemo(
    () => getProxyUrl(candidate.foodImageUrl),
    [candidate.foodImageUrl]
  );

  const showImage = !!proxiedUrl && !imageError;

  return (
    <button
      onClick={() => onSelect(candidate)}
      className={`group w-full text-left rounded-2xl overflow-hidden transition-all duration-300 ${
        isSelected
          ? "ring-2 ring-orange-500 shadow-xl shadow-orange-200/40 scale-[1.02]"
          : "shadow-sm hover:shadow-lg hover:shadow-orange-100/40 hover:scale-[1.02]"
      }`}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-orange-50 to-slate-50 relative overflow-hidden">
        {showImage ? (
          <img
            src={proxiedUrl!}
            alt={candidate.namaMakanan}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl transition-transform duration-300 group-hover:scale-110">
              🍜
            </span>
          </div>
        )}

        {isSelected && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-200/50">
            <CheckIcon />
          </div>
        )}

        {candidate.foodImageMatchScore !== null && candidate.foodImageMatchScore < 30 && (
          <span className="absolute top-3 left-3 bg-yellow-400/90 backdrop-blur-sm text-xs px-2.5 py-1 rounded-full font-medium text-yellow-800">
            placeholder
          </span>
        )}
      </div>

      <div className={`p-4 transition-colors duration-200 ${
        isSelected ? "bg-orange-50/80" : "bg-white"
      }`}>
        <h3 className={`font-bold text-base mb-1 transition-colors duration-200 ${
          isSelected ? "text-orange-700" : "text-slate-800"
        }`}>
          {candidate.namaMakanan}
        </h3>
        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
          {candidate.deskripsiSingkat}
        </p>
      </div>
    </button>
  );
}

interface FoodCandidateGridProps {
  candidates: FoodCandidate[];
  selectedId: string | null;
  onSelect: (candidate: FoodCandidate) => void;
}

export function FoodCandidateGrid({
  candidates,
  selectedId,
  onSelect,
}: FoodCandidateGridProps) {
  const handleSelect = (candidate: FoodCandidate) => {
    onSelect(candidate);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
      {candidates.map((candidate, index) => (
        <div
          key={candidate.id}
          className={`animate-fade-in-up`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <FoodCandidateCard
            candidate={candidate}
            onSelect={handleSelect}
            isSelected={selectedId === candidate.id}
          />
        </div>
      ))}
    </div>
  );
}
