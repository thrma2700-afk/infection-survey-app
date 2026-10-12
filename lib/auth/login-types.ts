// 로그인 종류(의료기관용·조사관용·관리자용). 화면의 로그인 입구를 나누기 위한 것이고,
// 실제 허용 여부는 로그인 처리(lib/auth/actions.ts)가 서버에서 계정의 역할과 맞는지 확인해 결정한다.
// 이 파일은 다른 파일을 가져오지 않는다. (점검 도구가 그대로 불러다 시험할 수 있게)

export type LoginType = "institution" | "surveyor" | "admin";

export const loginTypes: LoginType[] = ["institution", "surveyor", "admin"];

export const loginTypeLabels: Record<LoginType, string> = {
  institution: "의료기관",
  surveyor: "조사관",
  admin: "관리자",
};

export const loginTypeDescriptions: Record<LoginType, string> = {
  institution: "우리 기관의 조사 결과와 관리자 코멘트를 확인합니다. 승인된 의료기관 담당자만 이용할 수 있습니다.",
  surveyor: "배정된 의료기관의 조사 자료를 입력하고 제출합니다. 관리자가 발급한 조사관 계정으로 로그인합니다.",
  admin: "회차·기관·계정을 관리하고 결과를 검증·공개합니다. 관리자 계정으로 로그인합니다.",
};

export function isLoginType(value: unknown): value is LoginType {
  return typeof value === "string" && (loginTypes as string[]).includes(value);
}

/** 이 계정의 역할로 이 종류의 로그인을 쓸 수 있는가 */
export function canLoginAs(role: string, type: LoginType): boolean {
  return role === type;
}
