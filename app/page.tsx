// 첫 화면: 로그인 없이 누구나 보는 화면 하나. (Design Ref: §2.2 `/`)
// 실태조사 정의·개요·주요내용·주요결과, 이 시스템에서 공표된 회차별 결과(공표일, 참여율, 종별 추정치)와 지난 회차 이력을 보여 준다.
// 권한이 필요한 내용(조사 자료 입력, 본인 기관 자료, 관리)을 보려고 할 때만 로그인한다.
import type { ReactNode } from "react";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { HomeAuthLink } from "@/components/home-auth-link";
import { PublicResultsView } from "@/components/public-results";
import { cycleSchedule, keyPoints, overview, reports, sourcePage, surveyDefinition } from "@/lib/public/content";
import { getPublicResults } from "@/lib/public/results";
import { ui } from "@/lib/ui";

// 공표 내역은 요청마다 읽는다. (공개를 철회하면 즉시 사라져야 한다)
async function PublishedResults() {
  const results = await getPublicResults();
  return <PublicResultsView results={results} />;
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="flex scroll-mt-24 items-center gap-2 text-xl font-bold">
      <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
      {children}
    </h2>
  );
}

const quickLinks = [
  { href: "#published", label: "회차별 공표 내역" },
  { href: "#key-points", label: "주요내용" },
  { href: "#reports", label: "주요결과" },
];

const facts = ["3년 주기 조사", "표본 의료기관 현장·온라인 조사", "회차별 결과 공표"];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-3">
          <Brand compact />
          <HomeAuthLink />
        </div>
      </header>

      <section aria-labelledby="definition" className="border-b border-border bg-info-soft">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-12 sm:py-16">
          <span className={`${ui.badge} w-fit`}>의료관련감염 예방·관리</span>
          <h1 id="definition" className="text-3xl font-bold tracking-tight sm:text-4xl">
            의료기관 감염관리 실태조사
          </h1>
          <p className="text-lg font-medium sm:text-xl">{surveyDefinition}</p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{overview}</p>
          <ul className="flex flex-wrap gap-2">
            {facts.map((fact) => (
              <li key={fact} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
                {fact}
              </li>
            ))}
          </ul>
          <nav aria-label="이 화면의 구역" className="flex flex-wrap gap-2 pt-1">
            {quickLinks.map((link) => (
              <a key={link.href} href={link.href} className={`${ui.buttonSecondary} !py-2`}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-14 px-4 py-12">
        <section aria-labelledby="published" className="flex flex-col gap-4">
          <div>
            <SectionTitle id="published">회차별 공표 내역</SectionTitle>
            <p className="mt-2 text-sm text-muted">
              이 시스템에서 공표된 결과를 최근 회차부터 보여 드립니다. 지난 회차도 계속 쌓여 표시됩니다. 기관별 개별 결과는 해당 기관만 로그인해서 볼 수 있습니다.
            </p>
          </div>
          <Suspense fallback={<p className="text-sm text-muted">공표 내역을 불러오는 중…</p>}>
            <PublishedResults />
          </Suspense>
        </section>

        <section aria-labelledby="key-points" className="flex flex-col gap-4">
          <SectionTitle id="key-points">주요내용</SectionTitle>
          <dl className="grid gap-4 sm:grid-cols-2">
            {keyPoints.map((point) => (
              <div key={point.title} className={`${ui.card} p-5`}>
                <dt className="font-bold">{point.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{point.text}</dd>
              </div>
            ))}
          </dl>

          <div className={ui.tableWrap}>
            <table className="w-full min-w-[28rem] border-collapse bg-background">
              <caption className="border-b border-border bg-background px-4 py-3 text-left text-sm font-bold">
                조사 주기별 일정
              </caption>
              <thead>
                <tr>
                  <th className={ui.th}>주기</th>
                  <th className={ui.th}>연도</th>
                  <th className={ui.th}>조사 대상</th>
                </tr>
              </thead>
              <tbody>
                {cycleSchedule.map((row) => (
                  <tr key={row.year}>
                    <td className={ui.td}>
                      <span className={row.cycle === "1주기" ? ui.badgeMuted : ui.badge}>{row.cycle}</span>
                    </td>
                    <td className={`${ui.td} font-medium`}>{row.year}</td>
                    <td className={ui.td}>{row.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="reports" className="flex flex-col gap-4">
          <div>
            <SectionTitle id="reports">주요결과</SectionTitle>
            <p className="mt-2 text-sm text-muted">
              질병관리청이 공개한 연도별 실태조사 결과 보고서입니다. (PDF, 새 창으로 열립니다)
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {reports.map((report) => (
              <li key={report.year}>
                <a
                  href={report.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.card} group flex items-center gap-4 p-4 transition-colors hover:border-accent hover:bg-primary-soft`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary group-hover:bg-background"
                  >
                    PDF
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{report.year}</span>
                    <span className="mt-0.5 block text-sm text-muted">{report.label}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border bg-background px-4 py-8 text-sm text-muted">
        <p className="mx-auto max-w-4xl">
          개요·주요내용·주요결과는{" "}
          <a href={sourcePage.url} target="_blank" rel="noopener noreferrer" className={ui.link}>
            {sourcePage.label}
          </a>{" "}
          안내를 요약한 것입니다. (확인일 {sourcePage.checkedOn}) 정확한 내용은 출처 페이지와 보고서를 확인해 주세요.
        </p>
      </footer>
    </div>
  );
}
