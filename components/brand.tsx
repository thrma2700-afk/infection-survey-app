// 앱 이름과 작은 마크. 마크는 이 앱을 위해 직접 만든 단순한 모양(방패와 확인 표시)이다.
import Link from "next/link";

export const APP_NAME = "감염관리 실태조사 관리 시스템";

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-accent text-white ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4.5 6v5.5c0 4.4 3 7.9 7.5 9.5 4.5-1.6 7.5-5.1 7.5-9.5V6L12 3Z" />
        <path d="m8.8 12 2.3 2.3 4.2-4.6" />
      </svg>
    </span>
  );
}

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2.5 font-bold leading-tight text-foreground">
      <BrandMark />
      <span className={compact ? "truncate text-sm" : "text-sm"}>{APP_NAME}</span>
    </Link>
  );
}
