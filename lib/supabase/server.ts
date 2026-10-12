// Design Ref: §5 — 서버가 모든 권한을 결정한다. 저장소 연결은 서버 코드에서만 만든다.
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicConfig, readEnv } from "./config";
// 데이터베이스 표 구조에서 자동으로 만든 타입 (표를 바꾸면 supabase gen types로 다시 만든다)
import type { Database } from "./database.types";

// 서버에서는 로그인 상태를 저장하지 않으므로 세션 유지 옵션을 끈다.
const serverOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/**
 * 로그인하지 않은 상태로 만든 연결 (공개 키).
 * 저장소의 행 단위 접근 규칙(RLS)이 로그인하지 않은 사용자 기준으로 적용된다.
 * 로그인한 사용자의 요청을 처리할 때는 이 연결이 아니라 createUserClient()를 쓴다.
 */
export function createPublicClient() {
  const { url, publishableKey } = getPublicConfig();
  return createClient<Database>(url, publishableKey, serverOptions);
}

/**
 * 지금 요청을 보낸 사용자의 로그인 정보(쿠키)로 만든 연결. 사용자 요청의 조회·저장은 이 연결로 한다.
 * 저장소의 접근 규칙(RLS)이 그 사용자의 역할 그대로 적용되므로, 서버 코드에 실수가 있어도 다른 기관의 자료가 나가지 않는다.
 * 로그인 쿠키는 브라우저 스크립트가 읽지 못하게(HttpOnly) 저장한다.
 */
export async function createUserClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 화면을 그리는 중에는 쿠키를 쓸 수 없다. 로그인 정보 갱신은 proxy.ts가 맡는다.
        }
      },
    },
  });
}

/**
 * 비밀 키로 만든 연결. 저장소의 접근 규칙(RLS)을 건너뛰므로 다음을 지킨다.
 *  - 서버 코드에서만 쓰고(이 파일은 server-only), 비밀 키는 이 파일에서만 읽는다.
 *  - 호출하기 전에 로그인 사용자의 역할을 먼저 검사한다. (예: 관리자 계정 발급, 추정치 산출 결과 저장)
 *  - 이 연결로 얻은 결과를 브라우저(클라이언트 컴포넌트)나 캐시로 넘기지 않는다.
 *  - 사용자 요청의 조회·저장에는 쓰지 않는다. (저장소가 다른 기관 id 요청을 막아 주지 못한다)
 */
export function createAdminClient() {
  const { url } = getPublicConfig();
  return createClient<Database>(url, readEnv("SUPABASE_SECRET_KEY"), serverOptions);
}
