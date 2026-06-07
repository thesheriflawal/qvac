"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export default function TermsPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.push("/profile")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Terms & Conditions</h1>
      <div className="bg-white rounded-2xl p-6 prose prose-sm max-w-none">
        <h2>1. Introduction</h2><p>Welcome to Kynettic. By using our services, you agree to these terms.</p>
        <h2>2. Services</h2><p>Kynettic provides P2P cryptocurrency trading services. All trades are automated and secured.</p>
        <h2>3. User Responsibilities</h2><p>Users must complete KYC verification. Users are responsible for the security of their accounts.</p>
        <h2>4. Privacy</h2><p>We collect and process data in accordance with our Privacy Policy.</p>
        <h2>5. Limitation of Liability</h2><p>Kynettic is not liable for losses due to market volatility or third-party actions.</p>
      </div>
    </div>
  );
}
