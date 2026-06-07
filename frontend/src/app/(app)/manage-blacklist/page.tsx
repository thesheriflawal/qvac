"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserX } from "lucide-react";
export default function ManageBlacklistPage() {
  const router = useRouter(); const [blacklist] = useState<any[]>([]);
  return (
    <div>
      <button onClick={() => router.push("/profile")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Manage Blacklist</h1>
      <div className="bg-white rounded-2xl p-5">
        {blacklist.length === 0 ? (
          <div className="text-center py-16"><UserX size={48} className="text-gray-200 mx-auto mb-4"/><p className="text-gray-400">No blacklisted users</p></div>
        ) : blacklist.map((u: any, i: number) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50"><span className="text-sm">{u.username}</span><button className="text-red-500 text-sm cursor-pointer">Remove</button></div>
        ))}
      </div>
    </div>
  );
}
