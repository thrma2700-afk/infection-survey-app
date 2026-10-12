// 로그인 전 화면의 공통 모양: 메뉴 없이 연한 바탕 가운데에 카드 하나. (Design Ref: §2.1)
import type { ReactNode } from "react";

import { Brand } from "./brand";
import { ui } from "@/lib/ui";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-surface px-4 py-12">
      <div className="mb-6">
        <Brand />
      </div>
      <div className={`${ui.card} w-full max-w-md p-6 sm:p-8`}>
        <h1 className="text-center text-xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-center text-sm text-muted">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
