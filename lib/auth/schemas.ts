// 로그인·비밀번호 입력값 검증. 서버 처리(lib/auth/actions.ts)가 사용자 입력을 그대로 믿지 않고 여기서 먼저 검사한다.
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254),
  // 로그인에서는 길이만 제한한다. (규칙을 알려 주지 않고 틀린 이유도 구분해 알려 주지 않는다)
  password: z.string().min(1).max(200),
});

// 새 비밀번호 정책: 10자 이상, 영문자와 숫자를 모두 포함 (Supabase 설정과 같게 맞춤)
const passwordRule = z
  .string()
  .min(10, "비밀번호는 10자 이상이어야 합니다.")
  .max(200, "비밀번호가 너무 깁니다.")
  .regex(/[A-Za-z]/, "비밀번호에 영문자를 포함해 주세요.")
  .regex(/[0-9]/, "비밀번호에 숫자를 포함해 주세요.");

export const newPasswordSchema = z
  .object({
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["confirm"],
  });

export const resetRequestSchema = z.object({
  email: z.email().max(254),
});

// 의료기관 회원가입 신청. 역할·상태는 받지 않는다. (서버가 정한다)
// 요양기관번호 형식은 아직 확인된 규칙이 없어, 4~20자의 숫자·영문자·하이픈으로 느슨하게 받는다.
export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해 주세요.").max(50, "이름이 너무 깁니다."),
    email: z.email("이메일 형식이 올바르지 않습니다.").max(254, "이메일이 너무 깁니다."),
    institutionName: z.string().trim().min(1, "소속 의료기관 이름을 입력해 주세요.").max(100, "기관 이름이 너무 깁니다."),
    ykiho: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{4,20}$/, "요양기관번호는 4~20자의 숫자·영문자·하이픈으로 입력해 주세요."),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["confirm"],
  });

// 관리자의 가입 신청 처리 요청
export const reviewSchema = z.object({
  profileId: z.uuid(),
  decision: z.enum(["approve", "replace", "reject"]),
  // 기관 종별(선택). 비어 있으면 바꾸지 않는다.
  institutionType: z.string().trim().max(30, "기관 종별은 30자 이하로 입력해 주세요.").optional(),
});
