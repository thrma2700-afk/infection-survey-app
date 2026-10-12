import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 한글을 읽기 좋은 Noto Sans KR. (필요한 글자 조각만 내려받아 쓴다)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "감염관리 실태조사 관리 시스템",
  description: "의료기관 감염관리 실태조사 자료의 입력, 검증, 결과 확인을 한곳에서 합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
