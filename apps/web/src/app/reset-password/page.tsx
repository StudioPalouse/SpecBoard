import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = { title: "Reset password · Specboard" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
