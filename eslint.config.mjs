import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 이 프로젝트의 코드가 아닌 외부 도구 폴더는 검사하지 않는다.
    "external-tools/**",
    // 삭제 대기 중인 파일 보관 폴더
    "trash-can/**",
  ]),
]);

export default eslintConfig;
