// 공표된 결과를 읽는다. 로그인 없이 누구나 보는 첫 화면에서 쓴다.
// 읽는 곳은 공개용 조회 3개(public_rounds, public_participation, public_estimates)뿐이고, 공표된 회차의 집계 값만 담겨 있다.
// 기관별 개별 결과·표 원본은 로그인하지 않은 사람에게 닫혀 있어서, 이 코드로는 읽을 수 없다.
// 철회가 즉시 반영되어야 하므로 캐시하지 않는다. (요청마다 읽는다)
import "server-only";

import { createPublicClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type PublicEstimate = {
  institutionType: string;
  sampleCount: number;
  values: Json;
  methodNote: string;
};

export type PublicRound = {
  roundId: string;
  roundName: string;
  year: number;
  publishedAt: string | null;
  submittedCount: number | null;
  totalInstitutionCount: number | null;
  participationRatePct: number | null;
  estimates: PublicEstimate[];
};

export type PublicResults = { ok: true; rounds: PublicRound[] } | { ok: false };

export async function getPublicResults(): Promise<PublicResults> {
  const supabase = createPublicClient();

  const [roundsResult, participationResult, estimatesResult] = await Promise.all([
    supabase.from("public_rounds").select("*").order("published_at", { ascending: false }).limit(200),
    supabase.from("public_participation").select("*").limit(200),
    supabase.from("public_estimates").select("*").order("institution_type").limit(5000),
  ]);

  if (roundsResult.error || participationResult.error || estimatesResult.error) {
    return { ok: false };
  }

  const participation = new Map(
    participationResult.data.flatMap((row) => (row.round_id ? [[row.round_id, row] as const] : [])),
  );

  const estimatesByRound = new Map<string, PublicEstimate[]>();
  for (const row of estimatesResult.data) {
    if (!row.round_id || row.institution_type === null || row.sample_count === null) continue;
    const list = estimatesByRound.get(row.round_id) ?? [];
    list.push({
      institutionType: row.institution_type,
      sampleCount: row.sample_count,
      values: row.estimate_values ?? {},
      methodNote: row.method_note ?? "",
    });
    estimatesByRound.set(row.round_id, list);
  }

  const rounds: PublicRound[] = roundsResult.data.flatMap((row) => {
    if (!row.round_id || row.round_name === null || row.year === null) return [];
    const p = participation.get(row.round_id);
    return [
      {
        roundId: row.round_id,
        roundName: row.round_name,
        year: row.year,
        publishedAt: row.published_at,
        submittedCount: p?.submitted_count ?? null,
        totalInstitutionCount: p?.total_institution_count ?? null,
        participationRatePct: p?.participation_rate_pct ?? null,
        estimates: estimatesByRound.get(row.round_id) ?? [],
      },
    ];
  });

  return { ok: true, rounds };
}
