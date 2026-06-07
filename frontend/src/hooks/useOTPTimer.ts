import { useState, useEffect, useCallback } from "react";

interface UseOTPTimerProps {
  initialTime?: number;
  maxResends?: number;
  autoStart?: boolean;
}

export function useOTPTimer({
  initialTime = 60,
  maxResends = 5,
  autoStart = true,
}: UseOTPTimerProps = {}) {
  const [timeLeft, setTimeLeft] = useState(autoStart ? initialTime : 0);
  const [resendCount, setResendCount] = useState(0);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const startTimer = useCallback(() => {
    if (resendCount >= maxResends) return false;
    setTimeLeft(initialTime);
    setResendCount((prev) => prev + 1);
    return true;
  }, [initialTime, maxResends, resendCount]);

  const resetTimer = useCallback(() => {
    setTimeLeft(0);
    setResendCount(0);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    timeLeft,
    resendCount,
    canResend: timeLeft === 0 && resendCount < maxResends,
    isLimitReached: resendCount >= maxResends,
    startTimer,
    resetTimer,
    formatTime: formatTime(timeLeft),
  };
}
