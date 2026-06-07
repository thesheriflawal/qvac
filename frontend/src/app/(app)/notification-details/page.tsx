"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams();
  const id = params.get("id");
  return (
    <div>
      <button onClick={() => router.push("/notifications")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <div className="bg-white rounded-2xl p-6"><h1 className="text-xl font-bold mb-4">Notification</h1><p className="text-sm text-gray-500">Notification ID: {id}</p></div>
    </div>
  );
}
export default function NotificationDetailsPage() { return <Suspense><Content/></Suspense>; }
