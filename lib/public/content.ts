// 첫 화면에 보여 주는 고정 안내 내용.
// 출처: 질병관리청 "의료기관 감염관리 실태조사" 안내 페이지의 개요·주요내용·주요결과를 요약한 것이다. (2026-10-12 확인)
// 원문이 바뀌면 이 파일을 고친다. 요약이므로 정확한 내용은 출처 페이지와 보고서를 따른다.

export const sourcePage = {
  label: "질병관리청 의료기관 감염관리 실태조사",
  url: "https://www.kdca.go.kr/kdca/3352/subview.do",
  checkedOn: "2026-10-12",
};

// 이 시스템에서 쓰는 실태조사의 정의
export const surveyDefinition = "의료기관의 감염관리 현황에 대한 실태조사";

// 개요
export const overview =
  "감염병예방법 제17조와 같은 법 시행규칙 제15조에 따라, 의료관련감염을 예방·관리하는 정책을 세우고 시행하는 데 필요한 기초자료를 마련하려고 3년 주기로 의료기관 감염관리 실태조사를 하고 그 결과를 공표합니다.";

// 주요내용
export const keyPoints: { title: string; text: string }[] = [
  {
    title: "조사 대상",
    text: "의료법 제3조에 해당하는 의료기관이며, 1·2차 의료기관도 포함합니다.",
  },
  {
    title: "조사 방법",
    text: "국내 규정과 지침을 반영해 만든 표준화 조사도구로, 표본 의료기관의 현장 실태조사와 온라인 설문조사를 합니다.",
  },
  {
    title: "조사 내용",
    text: "감염관리체계와 감염관리 활동 현황, 교육·예방 등을 조사합니다. 감염관리위원회와 감염관리실의 설치·운영, 감염관리 인력·장비·시설, 감염관리체계, 감염관리 교육과 예방에 관한 사항 등이 포함됩니다.",
  },
  {
    title: "조사 주기",
    text: "의료기관 종별(급성기병원, 요양·치과·한방병원, 의원급)에 따라 3년 주기로 시행합니다.",
  },
];

// 주기별 조사 일정
export const cycleSchedule: { cycle: string; year: string; target: string }[] = [
  { cycle: "1주기", year: "2021년", target: "급성기병원" },
  { cycle: "1주기", year: "2022년", target: "요양병원, 의원" },
  { cycle: "1주기", year: "2023년", target: "치과·한방 시범조사, 종합분석과 시스템 보완" },
  { cycle: "2주기", year: "2024년", target: "급성기병원(특수부서 포함)" },
  { cycle: "2주기", year: "2025년", target: "요양병원, 치과·한방병원" },
  { cycle: "2주기", year: "2026년", target: "의원, 치과·한방병원" },
];

// 주요결과: 질병관리청이 공개한 연도별 보고서 (PDF)
export const reports: { year: string; label: string; url: string }[] = [
  {
    year: "2021년",
    label: "2021년 국내 의료기관 감염관리 실태조사",
    url: "https://www.kdca.go.kr/sites/kdca/download/2021%EB%85%84+%EC%9D%98%EB%A3%8C%EA%B8%B0%EA%B4%80+%EA%B0%90%EC%97%BC%EA%B4%80%EB%A6%AC+%EC%8B%A4%ED%83%9C%EC%A1%B0%EC%82%AC+%EC%A3%BC%EC%9A%94%EA%B2%B0%EA%B3%BC.pdf",
  },
  {
    year: "2022년",
    label: "2022년 국내 의료기관 감염관리 실태조사",
    url: "https://www.kdca.go.kr/sites/kdca/download/2022%EB%85%84+%EC%9A%94%EC%96%91%EB%B3%91%EC%9B%90+%EA%B0%90%EC%97%BC%EA%B4%80%EB%A6%AC+%EC%8B%A4%ED%83%9C%EC%A1%B0%EC%82%AC.pdf",
  },
  {
    year: "2023년",
    label: "2023년 국내 의료기관 감염관리 실태조사",
    url: "https://www.kdca.go.kr/sites/kdca/download/2023%EB%85%84+%EC%9D%98%EC%9B%90+%EA%B0%90%EC%97%BC%EA%B4%80%EB%A6%AC+%EC%8B%A4%ED%83%9C%EC%A1%B0%EC%82%AC+%EC%A3%BC%EC%9A%94%EA%B2%B0%EA%B3%BC.pdf",
  },
  {
    year: "2024년",
    label: "2024년 국내 의료기관 감염관리 실태조사",
    url: "https://www.kdca.go.kr/bbs/kdca/263/305116/download.do",
  },
];
