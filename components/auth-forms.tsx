"use client";

// 로그인 전 화면의 입력 양식. 입력값 검증과 인증은 서버 처리(lib/auth/actions.ts)가 한다.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { type FormState, login, requestPasswordReset, signup, updatePassword } from "@/lib/auth/actions";
import type { LoginType } from "@/lib/auth/login-types";
import { ui } from "@/lib/ui";

const initialState: FormState = {};

const labelClass = "text-sm font-medium";

function Notice({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className={ui.noticeError}>
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className={ui.noticeSuccess}>
        {state.message}
      </p>
    );
  }
  return null;
}

export function LoginForm({ type }: { type: LoginType }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const justReset = useSearchParams().get("reset") === "1";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* 로그인 종류: 서버가 계정의 역할과 맞는지 다시 확인한다 */}
      <input type="hidden" name="type" value={type} />
      {justReset && !state.error ? (
        <p role="status" className={ui.noticeSuccess}>
          비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.
        </p>
      ) : null}
      <Notice state={state} />
      <label className={labelClass}>
        이메일
        <input name="email" type="email" autoComplete="username" required maxLength={254} className={ui.input} />
      </label>
      <label className={labelClass}>
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          className={ui.input}
        />
      </label>
      <button type="submit" disabled={pending} className={ui.buttonBlock}>
        {pending ? "로그인 중…" : "로그인"}
      </button>
      <Link href="/forgot-password" className={`${ui.link} text-center text-sm`}>
        비밀번호를 잊으셨나요?
      </Link>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Notice state={state} />
      <label className={labelClass}>
        이름
        <input name="name" type="text" autoComplete="name" required maxLength={50} className={ui.input} />
      </label>
      <label className={labelClass}>
        이메일
        <input name="email" type="email" autoComplete="username" required maxLength={254} className={ui.input} />
        <span className={ui.hint}>로그인에 쓰는 이메일입니다.</span>
      </label>
      <label className={labelClass}>
        소속 의료기관 이름
        <input name="institutionName" type="text" required maxLength={100} className={ui.input} />
      </label>
      <label className={labelClass}>
        요양기관번호
        <input
          name="ykiho"
          type="text"
          inputMode="text"
          autoComplete="off"
          required
          minLength={4}
          maxLength={20}
          pattern="[0-9A-Za-z\-]{4,20}"
          className={ui.input}
        />
        <span className={ui.hint}>숫자·영문자·하이픈 4~20자</span>
      </label>
      <label className={labelClass}>
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          className={ui.input}
        />
        <span className={ui.hint}>10자 이상, 영문자와 숫자를 모두 포함해 주세요.</span>
      </label>
      <label className={labelClass}>
        비밀번호 확인
        <input name="confirm" type="password" autoComplete="new-password" required maxLength={200} className={ui.input} />
      </label>

      {/* 사람에게는 보이지 않는 칸. 자동 입력 프로그램이 채우면 신청을 만들지 않는다 */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          웹사이트
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button type="submit" disabled={pending} className={ui.buttonBlock}>
        {pending ? "신청 중…" : "가입 신청"}
      </button>
      <p className="text-center text-xs text-muted">
        가입 신청 후 관리자가 승인해야 이용할 수 있습니다. 승인 전에는 어떤 결과도 볼 수 없습니다.
      </p>
      <Link href="/login/institution" className={`${ui.link} text-center text-sm`}>
        이미 계정이 있으신가요? 로그인
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Notice state={state} />
      <label className={labelClass}>
        가입한 이메일
        <input name="email" type="email" autoComplete="email" required maxLength={254} className={ui.input} />
      </label>
      <button type="submit" disabled={pending} className={ui.buttonBlock}>
        {pending ? "보내는 중…" : "재설정 안내 받기"}
      </button>
      <Link href="/login" className={`${ui.link} text-center text-sm`}>
        로그인으로 돌아가기
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Notice state={state} />
      <label className={labelClass}>
        새 비밀번호
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          className={ui.input}
        />
        <span className={ui.hint}>10자 이상, 영문자와 숫자를 모두 포함해 주세요.</span>
      </label>
      <label className={labelClass}>
        새 비밀번호 확인
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          maxLength={200}
          className={ui.input}
        />
      </label>
      <button type="submit" disabled={pending} className={ui.buttonBlock}>
        {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}
