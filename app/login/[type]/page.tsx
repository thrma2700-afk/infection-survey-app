// 종류별 로그인 화면: /login/institution, /login/surveyor, /login/admin
// 화면만 나뉘는 것이 아니라, 로그인 처리(서버)가 계정의 역할이 이 종류와 맞는지 확인한다.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/auth-forms";
import { isLoginType, loginTypeDescriptions, loginTypeLabels, loginTypes } from "@/lib/auth/login-types";
import { getSessionProfile } from "@/lib/auth/session";
import { roleHomes } from "@/lib/menu";
import { ui } from "@/lib/ui";

export function generateStaticParams() {
  return loginTypes.map((type) => ({ type }));
}

async function RedirectIfSignedIn() {
  const profile = await getSessionProfile();
  if (profile) {
    redirect(profile.approvalStatus === "approved" ? roleHomes[profile.role] : "/pending");
  }
  return null;
}

async function LoginContent({ params }: { params: PageProps<"/login/[type]">["params"] }) {
  const { type } = await params;
  if (!isLoginType(type)) {
    notFound();
  }

  return (
    <AuthCard title={`${loginTypeLabels[type]}용 로그인`} description={loginTypeDescriptions[type]}>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense fallback={<p className="text-center text-sm text-muted">불러오는 중…</p>}>
        <LoginForm type={type} />
      </Suspense>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        {type === "institution" ? (
          <Link href="/signup" className={ui.link}>
            의료기관 회원가입
          </Link>
        ) : null}
        <Link href="/login" className="text-muted underline underline-offset-4 hover:text-foreground">
          다른 로그인 선택
        </Link>
      </div>
    </AuthCard>
  );
}

export default function TypedLoginPage(props: PageProps<"/login/[type]">) {
  return (
    <Suspense fallback={null}>
      <LoginContent params={props.params} />
    </Suspense>
  );
}
