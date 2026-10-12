// Design Ref: §6.2 — 데이터 저장소로 Supabase를 쓴다. 연결 정보는 환경 변수(.env.local)에서만 읽는다.
//
// 필요한 환경 변수
//   NEXT_PUBLIC_SUPABASE_URL              프로젝트 주소 (브라우저에 노출되어도 되는 값)
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  공개 키 (브라우저에 노출되어도 되는 값, 접근 규칙으로 보호됨)
//
// 비밀 키(SUPABASE_SECRET_KEY)는 이 파일이 아니라 server.ts에서만 읽는다.
// 이 파일은 브라우저 코드에서도 가져다 쓸 수 있으므로, 비밀 키를 읽는 코드를 넣지 않는다.

export function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // 값 자체는 출력하지 않고, 어떤 이름이 비어 있는지만 알려 준다.
    throw new Error(`환경 변수 ${name} 값이 없습니다. .env.local을 확인하세요.`);
  }
  return value;
}

/** 프로젝트 주소와 공개 키. 브라우저와 서버 어디서나 쓸 수 있다. */
export function getPublicConfig() {
  return {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}
