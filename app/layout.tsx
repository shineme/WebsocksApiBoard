import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "任务调度系统 - 管理看板",
  description: "实时监控和日志查看",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
