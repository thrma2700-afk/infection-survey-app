// 화면 제목 영역: 제목과 한 줄 설명. 모든 화면이 같은 모양을 쓰게 한다.
import type { ReactNode } from "react";

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm text-muted">{description}</p> : null}
    </div>
  );
}

/** 아직 만들지 않은 화면의 자리 표시 */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-background px-6 py-14 text-center">
      <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
        …
      </span>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
