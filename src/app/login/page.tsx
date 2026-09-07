import { Suspense } from "react";
import LoginForm from "@/components/login-form";

export const metadata = { title: "Đăng nhập - Quản lý tiền trọ" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <LoginForm />
    </Suspense>
  );
}