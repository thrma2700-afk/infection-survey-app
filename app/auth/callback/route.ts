// 이메일의 비밀번호 재설정 링크가 돌아오는 곳. 링크에 붙은 일회용 코드를 로그인 정보로 바꾼 뒤 새 비밀번호 화면으로 보낸다.
// 이동할 곳은 정해진 주소뿐이다. (요청에 담긴 주소로 이동하지 않는다)
import { type NextRequest, NextResponse } from "next/server";

import { createUserClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  }

  // 링크가 만료되었거나 올바르지 않다
  return NextResponse.redirect(new URL("/forgot-password", request.url));
}
