"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] px-6">
          <img src="/iconletter.png" alt="Kynettic" style={{ width: 160, marginBottom: 24 }} />
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Something went wrong</h2>
          <p className="text-gray-500 text-sm text-center mb-6 max-w-xs">
            A browser extension may be interfering with the app. Try disabling wallet extensions (MetaMask, etc.) or opening in a private/incognito window.
          </p>
          <button
            onClick={reset}
            className="bg-[#4472B7] text-white px-6 py-3 rounded-lg font-semibold text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
