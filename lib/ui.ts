// 화면 공통 모양(버튼·입력칸·카드·안내 상자). 화면마다 따로 꾸미지 않고 여기 것을 가져다 쓴다.
// 색 이름은 app/globals.css에서 정한 값이다. (bg-primary, text-muted, border-border 등)

export const ui = {
  /** 흰 카드: 연한 테두리와 살짝 뜬 그림자 */
  card: "rounded-xl border border-border bg-background shadow-sm",
  /** 연한 면 카드 */
  panel: "rounded-xl border border-border bg-surface",

  input:
    "mt-1 w-full rounded-md border border-border-strong bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/40",

  buttonPrimary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50",
  buttonSecondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-border-strong bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50",
  /** 폭 전체를 쓰는 주 버튼(로그인 양식 등) */
  buttonBlock:
    "inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50",

  link: "text-primary underline underline-offset-4 hover:text-primary-hover",
  muted: "text-muted",
  hint: "mt-1 block text-xs font-normal text-muted",

  noticeError: "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger",
  noticeSuccess: "rounded-md border border-accent/30 bg-primary-soft px-3 py-2 text-sm text-primary",
  noticeWarning: "rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning",
  emptyBox: "rounded-xl border border-dashed border-border-strong bg-surface p-5 text-sm text-muted",

  /** 표 */
  tableWrap: "overflow-x-auto rounded-xl border border-border",
  th: "bg-surface px-4 py-2.5 text-left text-xs font-medium text-muted",
  td: "border-t border-border px-4 py-3 align-top text-sm",

  badge: "inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary",
  badgeMuted: "inline-flex items-center rounded-full bg-surface-strong px-2 py-0.5 text-xs text-muted",
} as const;
