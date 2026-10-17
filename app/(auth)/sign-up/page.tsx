import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <SignUpForm />
    </Suspense>
  );
}
