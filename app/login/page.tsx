// 로그인 종류 선택 화면. 의료기관용·조사관용·관리자용 로그인으로 나뉜다.
// 이미 로그인한 사용자는 역할에 맞는 첫 화면으로 보낸다.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { loginTypeDescriptions, loginTypeLabels, loginTypes } from "@/lib/auth/login-types";
import { getSessionProfile } from "@/lib/auth/session";
import { roleHomes } from "@/lib/menu";
import { ui } from "@/lib/ui";

async function RedirectIfSignedIn() {
  const profile = await getSessionProfile();
  if (profile) {
    redirect(profile.approvalStatus === "approved" ? roleHomes[profile.role] : "/pending");
  }
  return null;
}

export default function LoginPage() {
  return (
    <AuthCard title="로그인" description="이용하시는 구분을 선택해 로그인해 주세요.">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <ul className="flex flex-col gap-3">
        {loginTypes.map((type) => (
          <li key={type}>
            <Link
              href={`/login/${type}`}
              className="group flex items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:border-accent hover:bg-primary-soft"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary group-hover:bg-background"
              >
                {loginTypeLabels[type].slice(0, 1)}
              </span>
              <span>
                <span className="block font-semibold">{loginTypeLabels[type]}용 로그인</span>
                <span className="mt-0.5 block text-sm text-muted">{loginTypeDescriptions[type]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-muted">
        의료기관 담당자이신가요?{" "}
        <Link href="/signup" className={ui.link}>
          회원가입
        </Link>
      </p>
    </AuthCard>
  );
}
