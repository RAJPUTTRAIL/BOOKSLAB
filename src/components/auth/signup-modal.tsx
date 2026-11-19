"use client";

import { useRouter } from "next/navigation";
import { Modal } from "../ui/overlay";
import { useApp } from "../providers";
import { AuthForm } from "./auth-form";

/** Sign up / sign in without leaving the current page. Opened via useApp().openAuth(). */
export function SignupModal() {
  const { auth, closeAuth } = useApp();
  const router = useRouter();
  return (
    <Modal open={auth.open} onClose={closeAuth} title="Your Bookslab account">
      <AuthForm
        key={`${auth.tab}-${auth.open}`}
        initialTab={auth.tab}
        onDone={() => {
          closeAuth();
          if (auth.next) router.push(auth.next);
          router.refresh();
        }}
      />
    </Modal>
  );
}
