"use server";

// Design Ref: §5 — 로그인·로그아웃·비밀번호 재설정·회원가입 서버 처리.
// 서버 처리는 외부에서 직접 호출될 수 있는 입구이므로, 입력 검증과 권한 확인을 이 안에서 한다.
import { redirect } from "next/navigation";

import { roleHomes } from "@/lib/menu";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";

import { canLoginAs, isLoginType } from "./login-types";
import { loginSchema, newPasswordSchema, resetRequestSchema, signupSchema } from "./schemas";
import { getSessionProfile } from "./session";
import { applyForSignup } from "./signup-core";

export type FormState = { error?: string; message?: string };

// 이메일이 없는지, 비밀번호가 틀렸는지 구분해 알려 주지 않는다 (계정 존재 여부를 알아내는 것을 막는다)
const LOGIN_FAILED = "이메일 또는 비밀번호가 올바르지 않습니다.";
// 비밀번호까지 맞은 뒤에만 보여 주는 안내이므로 로그인 종류를 알려 줘도 계정 존재 여부가 새지 않는다
const WRONG_LOGIN_TYPE = "이 로그인으로는 이용할 수 없는 계정입니다. 로그인 종류(의료기관용·조사관용·관리자용)를 확인해 주세요.";
// 가입 여부와 상관없이 같은 문구를 보여 준다
const RESET_SENT = "입력하신 이메일로 재설정 안내를 보냈습니다. 메일을 확인해 주세요. (가입된 이메일인 경우에만 도착합니다)";
// 이미 가입된 이메일·요양기관번호이거나 신청이 몰려 만들지 않은 경우에도 같은 문구를 보여 준다
const SIGNUP_RECEIVED = "가입 신청이 접수되었습니다. 관리자가 승인하면 로그인해서 이용할 수 있습니다.";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const type = formData.get("type");
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success || !isLoginType(type)) {
    return { error: LOGIN_FAILED };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: LOGIN_FAILED };
  }

  // 로그인 종류와 계정의 역할이 맞는지 서버에서 확인한다. 맞지 않으면 로그인 상태를 바로 지운다.
  const profile = await getSessionProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: LOGIN_FAILED };
  }
  if (!canLoginAs(profile.role, type)) {
    await supabase.auth.signOut();
    return { error: WRONG_LOGIN_TYPE };
  }

  // 역할에 맞는 첫 화면으로 보낸다. 승인되지 않은 계정은 승인 대기 화면으로 보낸다.
  if (profile.approvalStatus !== "approved") {
    redirect("/pending");
  }
  redirect(roleHomes[profile.role]);
}

export async function logout(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse({ email: String(formData.get("email") ?? "").trim() });
  if (!parsed.success) {
    return { error: "이메일 형식이 올바르지 않습니다." };
  }

  const supabase = await createUserClient();
  // 성공·실패와 상관없이 같은 안내를 돌려준다. (오류 내용으로 가입 여부를 알려 주지 않는다)
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback`,
  });
  return { message: RESET_SENT };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  // 재설정 링크로 들어와 로그인 정보가 생긴 사용자만 비밀번호를 바꿀 수 있다
  const supabase = await createUserClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    redirect("/forgot-password");
  }

  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "비밀번호를 확인해 주세요." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "비밀번호를 바꾸지 못했습니다. 정책에 맞는 새 비밀번호인지 확인한 뒤 다시 시도해 주세요." };
  }

  // 바꾼 뒤에는 모든 기기에서 로그아웃하고, 새 비밀번호로 다시 로그인하게 한다
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reset=1");
}

/**
 * 의료기관 회원가입 신청. 로그인 전 사용자가 부르는 입구라서 사용자의 역할 검사를 할 수 없다.
 * 대신 (1) 입력을 검증하고, (2) 역할(의료기관)과 상태(승인 대기)는 서버가 고정하며, (3) 신청이 몰리면 만들지 않고, (4) 결과를 같은 문구로 알려 준다.
 * 승인 전에는 어떤 결과도 볼 수 없다.
 */
export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  // 사람이 보지 못하는 칸(website)에 값이 있으면 자동 입력 프로그램으로 보고, 아무것도 만들지 않고 같은 응답을 돌려준다
  if (String(formData.get("website") ?? "") !== "") {
    return { message: SIGNUP_RECEIVED };
  }

  const parsed = signupSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
    institutionName: String(formData.get("institutionName") ?? ""),
    ykiho: String(formData.get("ykiho") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력한 내용을 확인해 주세요." };
  }

  const { name, email, institutionName, ykiho, password } = parsed.data;
  const outcome = await applyForSignup(createAdminClient(), { name, email, institutionName, ykiho, password });

  if (outcome === "busy") {
    return { error: "지금은 가입 신청이 많아 접수하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }
  if (outcome === "error") {
    return { error: "가입 신청을 처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { message: SIGNUP_RECEIVED };
}
