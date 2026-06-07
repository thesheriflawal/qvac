"use client";
import { useEffect, useState } from "react";
import GoogleLoginButton from "./GoogleLoginButton";
import AppleLoginButton from "./AppleLoginButton";

type Mode = "login" | "signup";

export default function SocialLoginButtons({ mode }: { mode: Mode }) {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent));
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full">
      <GoogleLoginButton mode={mode} />
      {!isAndroid && <AppleLoginButton mode={mode} />}
    </div>
  );
}
