// 회차별 공표 내역 화면. 로그인 없이 보이는 집계 값만 받아 그린다. (기관 이름·기관별 값은 받지 않는다)
import type { PublicResults, PublicRound } from "@/lib/public/results";
import type { Json } from "@/lib/supabase/database.types";
import { ui } from "@/lib/ui";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(value: string | null) {
  if (!value) return "공표일 미상";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "공표일 미상" : dateFormat.format(date);
}

// 추정치는 항목 이름과 값의 묶음이다. 조사표 항목이 정해지지 않아 항목 이름을 그대로 보여 준다.
function formatValue(value: Json | undefined): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 200);
  return String(value);
}

function valueEntries(values: Json): [string, string][] {
  if (values && typeof values === "object" && !Array.isArray(values)) {
    return Object.entries(values).map(([key, value]) => [key, formatValue(value)]);
  }
  return [["값", formatValue(values)]];
}

/** 참여율을 크게 보여 주는 칸 */
function ParticipationStat({ round }: { round: PublicRound }) {
  if (round.submittedCount === null) return null;

  if (round.totalInstitutionCount && round.participationRatePct !== null) {
    return (
      <div className="rounded-lg bg-primary-soft px-4 py-3 text-right sm:min-w-44">
        <p className="text-xs text-muted">의료기관 참여율</p>
        <p className="text-2xl font-bold leading-tight text-primary">{round.participationRatePct}%</p>
        <p className="text-xs text-muted">
          참여 {round.submittedCount.toLocaleString("ko-KR")}곳 ÷ 전체 {round.totalInstitutionCount.toLocaleString("ko-KR")}곳
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-surface-strong px-4 py-3 text-right sm:min-w-44">
      <p className="text-xs text-muted">참여 의료기관</p>
      <p className="text-2xl font-bold leading-tight">{round.submittedCount.toLocaleString("ko-KR")}곳</p>
      <p className="text-xs text-muted">전체 의료기관 수 집계 전이라 참여율은 아직 없습니다</p>
    </div>
  );
}

function RoundCard({ round, open }: { round: PublicRound; open: boolean }) {
  return (
    <details open={open} className={`${ui.card} group p-5`}>
      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{round.roundName}</span>
            <span className={ui.badge}>공표</span>
          </span>
          <span className="mt-1 block text-sm text-muted">
            {round.year}년 · 공표일 {formatDate(round.publishedAt)}
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
            기관 종별 추정치 보기
            <svg viewBox="0 0 20 20" className="size-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 8 5 5 5-5" />
            </svg>
          </span>
        </span>
        <ParticipationStat round={round} />
      </summary>

      <div className="mt-5">
        {round.estimates.length === 0 ? (
          <p className={ui.emptyBox}>
            공표된 기관 종별 추정치가 없습니다. (응답 기관이 적은 종별은 보이지 않습니다)
          </p>
        ) : (
          <div className={ui.tableWrap}>
            <table className="w-full min-w-[32rem] border-collapse">
              <caption className="sr-only">{round.roundName} 기관 종별 추정치</caption>
              <thead>
                <tr>
                  <th className={ui.th}>기관 종별</th>
                  <th className={ui.th}>표본 수</th>
                  <th className={ui.th}>추정치</th>
                  <th className={ui.th}>산출 기준</th>
                </tr>
              </thead>
              <tbody>
                {round.estimates.map((estimate) => (
                  <tr key={estimate.institutionType}>
                    <td className={`${ui.td} font-medium`}>{estimate.institutionType}</td>
                    <td className={ui.td}>{estimate.sampleCount.toLocaleString("ko-KR")}</td>
                    <td className={ui.td}>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                        {valueEntries(estimate.values).map(([key, text]) => (
                          <div key={key} className="contents">
                            <dt className="text-muted">{key}</dt>
                            <dd>{text}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                    <td className={ui.td}>{estimate.methodNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

export function PublicResultsView({ results }: { results: PublicResults }) {
  if (!results.ok) {
    return (
      <p role="alert" className={ui.noticeError}>
        공표 내역을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  }
  if (results.rounds.length === 0) {
    return (
      <p className={ui.emptyBox}>
        아직 공표된 결과가 없습니다. 결과가 공표되면 이곳에 회차별로 쌓여 표시됩니다.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {results.rounds.map((round, index) => (
        <RoundCard key={round.roundId} round={round} open={index === 0} />
      ))}
    </div>
  );
}
