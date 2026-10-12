// Design Ref: §5 — 접속 단계(보조) 권한 확인.
// 하는 일: (1) 로그인 정보(쿠키)가 만료되기 전에 갱신한다. (2) 로그인하지 않은 사람이 보호된 화면 주소로 들어오면 로그인 화면으로 돌려보낸다.
// 하지 않는 일: 역할·승인 여부 판단. 이것은 각 화면·서버 처리가 lib/auth/session.ts의 requireRole로 직접 한다.
// (Next.js 안내서: Proxy는 빠른 사전 확인용이며 권한 처리의 전부로 쓰지 않는다.)
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// 로그인해야 볼 수 있는 화면 주소
const protectedPrefixes = ["/admin", "/surveyor", "/dashboard", "/pending", "/reset-password"];

function isProtected(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Supabase 로그인 쿠키가 있는지(이름만) 본다
function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPath = isProtected(pathname);

  // 로그인 쿠키가 없으면 갱신할 것도 없다
  if (!hasAuthCookie(request)) {
    if (protectedPath) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // 로그인 정보의 서명과 만료를 확인하고, 필요하면 갱신한다
  const { data } = await supabase.auth.getClaims();

  if (protectedPath && !data?.claims) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    // 갱신·삭제된 쿠키를 그대로 전달한다
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  // 정적 파일과 이미지는 제외한다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
