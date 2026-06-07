"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Copy, CheckCircle2, Share2, Users, TrendingUp,
  ChevronRight, Wallet, Gift, Clock, Star,
} from "lucide-react";
import { referralService } from "@/services/referral.service";
import { getErrorMessage } from "@/utils/errorHandler";

const fmt = (n: string | number) =>
  parseFloat(String(n)).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type View = "main" | "earnings" | "leaderboard";
type LbPeriod = "alltime" | "month" | "week";
type EarningsTab = "earnings" | "withdrawals";

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-[#EBF4FF] flex items-center justify-center shrink-0">
      <span className="text-sm font-bold" style={{ color: "#4472B7" }}>{(name || "?")[0].toUpperCase()}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#4472B7", borderTopColor: "transparent" }} />
    </div>
  );
}

export default function ReferralsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("main");
  const [copied, setCopied] = useState(false);
  const [lbPeriod, setLbPeriod] = useState<LbPeriod>("alltime");
  const [earningsTab, setEarningsTab] = useState<EarningsTab>("earnings");

  /* ── Main data ── */
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  /* ── Earnings data ── */
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsPage, setClaimsPage] = useState(1);
  const [claimsTotalPages, setClaimsTotalPages] = useState(1);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");

  /* ── Leaderboard data ── */
  const [lbData, setLbData] = useState<any[]>([]);
  const [lbMe, setLbMe] = useState<any>(null);
  const [lbLoading, setLbLoading] = useState(false);

  /* ── My Referrals data ── */
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralsPage, setReferralsPage] = useState(1);
  const [referralsTotalPages, setReferralsTotalPages] = useState(1);
  const [referralsLoading, setReferralsLoading] = useState(false);

  /* ── Load profile on mount ── */
  useEffect(() => {
    referralService.getReferralProfile()
      .then(res => setProfile(res?.data || res))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  /* ── Load claims when earnings view opens or tab/page changes ── */
  const loadClaims = useCallback(async (page: number) => {
    setClaimsLoading(true);
    try {
      const res = await referralService.getClaims(page, 20);
      const items = res?.data || [];
      setClaims(items);
      setClaimsTotalPages(res?.pagination?.total_pages ?? 1);
    } catch {}
    finally { setClaimsLoading(false); }
  }, []);

  useEffect(() => {
    if (view === "earnings") loadClaims(claimsPage);
  }, [view, claimsPage, loadClaims]);

  /* ── Load leaderboard when leaderboard view opens or period changes ── */
  const loadLeaderboard = useCallback(async (period: LbPeriod) => {
    setLbLoading(true);
    try {
      const res = await referralService.getLeaderboard(period);
      const inner = res?.data?.data ?? res?.data ?? [];
      setLbData(Array.isArray(inner) ? inner : []);
      setLbMe(res?.data?.me ?? null);
    } catch {}
    finally { setLbLoading(false); }
  }, []);

  useEffect(() => {
    if (view === "leaderboard") loadLeaderboard(lbPeriod);
  }, [view, lbPeriod, loadLeaderboard]);

  const loadReferrals = useCallback(async (page: number) => {
    setReferralsLoading(true);
    try {
      const res = await referralService.getReferrals(page, 10);
      setReferrals(res?.data || []);
      setReferralsTotalPages(res?.pagination?.total_pages ?? 1);
    } catch {}
    finally { setReferralsLoading(false); }
  }, []);

  useEffect(() => {
    if (view === "leaderboard") loadReferrals(referralsPage);
  }, [view, referralsPage, loadReferrals]);

  const referralCode = profile?.referral_code || "—";
  const maxEarnings = parseFloat(lbData[0]?.earnings || "1") || 1;

  const copy = () => {
    if (referralCode === "—") return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = () => {
    if (referralCode === "—") return;
    const link = `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`;
    const text = `Join Kynettic and earn ₦1,000 on your first trade! Sign up with my referral link:`;
    if (navigator.share) navigator.share({ title: "Join Kynettic", text, url: link });
    else navigator.clipboard.writeText(`${text} ${link}`);
  };

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError("");
    setClaimSuccess("");
    try {
      await referralService.claim();
      setClaimSuccess("Earnings successfully withdrawn to your NGN wallet.");
      // Refresh profile balance
      const res = await referralService.getReferralProfile();
      setProfile(res?.data || res);
      setClaimsPage(1);
      loadClaims(1);
    } catch (e: any) {
      setClaimError(getErrorMessage(e));
    } finally {
      setClaiming(false);
    }
  };

  const filteredClaims = claims.filter(c =>
    earningsTab === "earnings" ? c.type === "earning" : c.type === "withdrawal"
  );

  /* ─────────────────────────────────────────────────────────────
     MAIN VIEW
  ───────────────────────────────────────────────────────────── */
  if (view === "main") return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 cursor-pointer">
          <ArrowLeft size={20} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Referrals</h1>
      </div>

      {/* Hero */}
      <div className="rounded-2xl p-6 mb-5 text-white" style={{ backgroundColor: "#4472B7" }}>
        <div className="flex items-center gap-3 mb-4">
          <Gift size={20} className="text-white" />
          <p className="text-white font-bold text-base">Refer and Earn</p>
        </div>
        <p className="text-white/70 text-sm leading-relaxed mb-5">
          Earn <span className="text-white font-semibold">20%</span> of your referral's P2P trade fees. Your friend gets <span className="text-white font-semibold">₦1,000</span> on their first trade of $10 minimum.
        </p>
        {profileLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white/10 rounded-xl p-3 text-center animate-pulse">
                <div className="h-6 bg-white/20 rounded mb-1" />
                <div className="h-3 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "All-time",   value: profile?.total_referrals ?? 0 },
              { label: "This week",  value: profile?.referrals_this_week ?? 0 },
              { label: "This month", value: profile?.referrals_this_month ?? 0 },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-xl">{s.value}</p>
                <p className="text-white/50 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code */}
      <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100">
        <p className="text-xs text-gray-400 mb-3">Your referral code</p>
        <div className="flex items-center justify-between bg-[#EBF4FF] rounded-xl px-4 py-3 mb-4">
          <span className="font-mono font-black text-xl text-[#1D3B53] tracking-widest">
            {profileLoading ? "Loading..." : referralCode}
          </span>
          <button onClick={copy} className="cursor-pointer">
            {copied
              ? <CheckCircle2 size={20} style={{ color: "#4472B7" }} />
              : <Copy size={18} style={{ color: "#4472B7" }} />}
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={copy} disabled={profileLoading}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-[#1D3B53] text-sm font-semibold py-3 rounded-xl cursor-pointer disabled:opacity-40">
            <Copy size={14} />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={share} disabled={profileLoading}
            className="flex-1 flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-xl cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: "#4472B7" }}>
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      {/* Nav rows */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <button onClick={() => setView("earnings")} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
            <Wallet size={16} style={{ color: "#4472B7" }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-[#1D3B53]">Referral Earnings</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {profileLoading ? "Loading..." : `₦${fmt(profile?.balance ?? 0)} available`}
            </p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        <div className="h-px bg-gray-100 mx-5" />
        <button onClick={() => setView("leaderboard")} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
            <Star size={16} style={{ color: "#4472B7" }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-[#1D3B53]">Leaderboard</p>
            <p className="text-xs text-gray-400 mt-0.5">See where you rank</p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-[#1D3B53] mb-4">How it works</p>
        <div className="space-y-4">
          {[
            { icon: Share2,     title: "Share your code",   desc: "Send your code to friends" },
            { icon: Users,      title: "Friend signs up",   desc: "They register with your code" },
            { icon: Wallet,     title: "They earn #1,000 on their first deposit $10+", desc: "First qualifying deposit" },
            { icon: TrendingUp, title: "You earn 20%",      desc: "Of their P2P trade fees" },
          ].map(({ icon: Icon, title, desc }, i, arr) => (
            <div key={title} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-[#EBF4FF] flex items-center justify-center shrink-0">
                  <Icon size={15} style={{ color: "#4472B7" }} />
                </div>
                {i < arr.length - 1 && <div className="w-px h-4 bg-gray-100 mt-1" />}
              </div>
              <div className="pt-1">
                <p className="text-sm font-semibold text-[#1D3B53]">{title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     EARNINGS VIEW
  ───────────────────────────────────────────────────────────── */
  if (view === "earnings") return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView("main")} className="p-1 cursor-pointer">
          <ArrowLeft size={20} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Referral Earnings</h1>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl p-6 mb-5 text-white" style={{ backgroundColor: "#4472B7" }}>
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={14} className="text-white/50" />
          <p className="text-white/50 text-xs">Referral Balance</p>
        </div>
        <p className="text-white font-bold text-4xl mb-5">
          ₦{profileLoading ? "—" : fmt(profile?.balance ?? 0)}
        </p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "All Time",   value: profile?.earnings_all_time ?? "0" },
            { label: "This Week",  value: profile?.earnings_this_week ?? "0" },
            { label: "This Month", value: profile?.earnings_this_month ?? "0" },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
              <p className="text-white font-semibold text-sm">₦{fmt(s.value)}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {claimSuccess ? (
          <div className="bg-white/20 rounded-xl px-4 py-3 text-center">
            <p className="text-white text-sm font-semibold">{claimSuccess}</p>
          </div>
        ) : (
          <>
            {claimError && (
              <p className="text-white/80 text-xs text-center mb-2">{claimError}</p>
            )}
            <button
              onClick={handleClaim}
              disabled={claiming || profileLoading || parseFloat(profile?.balance ?? "0") <= 0}
              className="w-full bg-white font-semibold text-sm py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ color: "#4472B7" }}
            >
              {claiming
                ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#4472B7", borderTopColor: "transparent" }} />
                : <Wallet size={15} />}
              {claiming ? "Processing..." : "Withdraw to wallet"}
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {(["earnings", "withdrawals"] as EarningsTab[]).map(t => (
          <button key={t} onClick={() => { setEarningsTab(t); setClaimsPage(1); }}
            className={`flex-1 py-3 text-sm font-semibold cursor-pointer capitalize transition-colors ${earningsTab === t ? "border-b-2 text-[#1D3B53]" : "text-gray-400"}`}
            style={earningsTab === t ? { borderBottomColor: "#4472B7" } : {}}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {claimsLoading ? <Spinner /> : filteredClaims.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center mb-3">
            {earningsTab === "earnings"
              ? <TrendingUp size={22} style={{ color: "#4472B7" }} />
              : <Clock size={22} style={{ color: "#4472B7" }} />}
          </div>
          <p className="text-sm font-semibold text-[#1D3B53] mb-1">No {earningsTab} yet</p>
          <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
            {earningsTab === "earnings"
              ? "Your earnings will appear here once a friend completes their first deposit."
              : "You haven't made any withdrawals yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {filteredClaims.map((item: any, i: number) => (
              <div key={item.id || i}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
                    {item.type === "earning"
                      ? <TrendingUp size={15} style={{ color: "#4472B7" }} />
                      : <Wallet size={15} style={{ color: "#4472B7" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1D3B53] truncate">{item.description || (item.type === "earning" ? "Fee commission" : "Withdrawal")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#1D3B53]">₦{fmt(item.amount)}</p>
                    <p className={`text-[10px] mt-0.5 capitalize ${item.status === "completed" ? "text-green-500" : "text-gray-400"}`}>
                      {item.status || "—"}
                    </p>
                  </div>
                </div>
                {i < filteredClaims.length - 1 && <div className="h-px bg-gray-100 mx-4" />}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {claimsTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setClaimsPage(p => p - 1)} disabled={claimsPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-[#1D3B53] disabled:opacity-30 cursor-pointer">‹</button>
              <span className="text-xs text-gray-400">{claimsPage} / {claimsTotalPages}</span>
              <button onClick={() => setClaimsPage(p => p + 1)} disabled={claimsPage === claimsTotalPages}
                className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-[#1D3B53] disabled:opacity-30 cursor-pointer">›</button>
            </div>
          )}
        </>
      )}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     LEADERBOARD VIEW
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView("main")} className="p-1 cursor-pointer">
          <ArrowLeft size={20} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Leaderboard</h1>
      </div>

      {/* Period tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {([
          { key: "alltime", label: "All Time" },
          { key: "month",   label: "This Month" },
          { key: "week",    label: "This Week" },
        ] as { key: LbPeriod; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setLbPeriod(key)}
            className={`flex-1 py-3 text-sm font-semibold cursor-pointer transition-colors ${lbPeriod === key ? "border-b-2 text-[#1D3B53]" : "text-gray-400"}`}
            style={lbPeriod === key ? { borderBottomColor: "#4472B7" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {lbLoading ? <Spinner /> : (
        <>
          {lbData.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center mb-3">
                <Star size={22} style={{ color: "#4472B7" }} />
              </div>
              <p className="text-sm font-semibold text-[#1D3B53] mb-1">No data yet</p>
              <p className="text-xs text-gray-400">Be the first on the leaderboard</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
              {lbData.map((entry: any, i: number) => {
                const pct = Math.round((parseFloat(entry.earnings) / maxEarnings) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="w-5 text-xs font-bold text-gray-400 text-center shrink-0">{entry.rank ?? i + 1}</span>
                      <Avatar name={entry.username || "?"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1D3B53] truncate">{entry.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#4472B7" }} />
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0">{Number(entry.referrals).toLocaleString()} refs</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-[#1D3B53] shrink-0">₦{fmt(entry.earnings)}</p>
                    </div>
                    {i < lbData.length - 1 && <div className="h-px bg-gray-100 ml-14" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Current user row — always shown */}
          {lbMe && (
            <div className="bg-[#EBF4FF] rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ border: "1px solid #4472B720" }}>
              <span className="w-5 text-xs font-bold text-center shrink-0" style={{ color: "#4472B7" }}>
                {lbMe.rank ?? "—"}
              </span>
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                <span className="text-sm font-bold" style={{ color: "#4472B7" }}>
                  {(lbMe.username || "Y")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1D3B53]">{lbMe.username || "You"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-[#EBF4FF] rounded-full" />
                  <span className="text-[10px] text-gray-400 shrink-0">{Number(lbMe.referrals ?? 0).toLocaleString()} refs</span>
                </div>
              </div>
              <p className="text-sm font-bold text-[#1D3B53] shrink-0">₦{fmt(lbMe.earnings ?? 0)}</p>
            </div>
          )}

          {/* My Referrals */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-[#1D3B53] mb-3">My Referrals</p>
            {referralsLoading ? <Spinner /> : referrals.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center mb-3">
                  <Users size={22} style={{ color: "#4472B7" }} />
                </div>
                <p className="text-sm font-semibold text-[#1D3B53] mb-1">No referrals yet</p>
                <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
                  People who sign up with your code will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {referrals.map((ref: any, i: number) => (
                    <div key={ref.id || i}>
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <Avatar name={ref.username || ref.email || "?"} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1D3B53] truncate">
                            {ref.username || ref.email || "User"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Joined {ref.created_at ? new Date(ref.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </p>
                        </div>
                        {ref.is_qualified != null && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ref.is_qualified ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                            {ref.is_qualified ? "Qualified" : "Pending"}
                          </span>
                        )}
                      </div>
                      {i < referrals.length - 1 && <div className="h-px bg-gray-100 ml-14" />}
                    </div>
                  ))}
                </div>

                {referralsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button onClick={() => setReferralsPage(p => p - 1)} disabled={referralsPage === 1}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-[#1D3B53] disabled:opacity-30 cursor-pointer">‹</button>
                    <span className="text-xs text-gray-400">{referralsPage} / {referralsTotalPages}</span>
                    <button onClick={() => setReferralsPage(p => p + 1)} disabled={referralsPage === referralsTotalPages}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-[#1D3B53] disabled:opacity-30 cursor-pointer">›</button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
