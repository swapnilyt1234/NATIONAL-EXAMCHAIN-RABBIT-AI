import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock3,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  TimerReset,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="gov-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="hero-orb hero-orb-a" />
      <div className="hero-orb hero-orb-b" />
      <div className="hero-orb hero-orb-c" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="glass fade-in-up rounded-2xl px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="soft-glow rounded-2xl bg-slate-900/70 p-2.5 text-(--gov-cyan)">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Government of Examination Security</p>
                <h1 className="text-lg font-semibold text-zinc-100">National ExamChain Portal</h1>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:scale-[1.02] hover:bg-white/15"
            >
              Open Control Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <article className="glass hover-lift fade-in-up fade-delay-1 relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-400">National Digital Infrastructure</p>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-zinc-100 sm:text-4xl md:text-[2.7rem]">
              Tamper-resistant exam delivery with timed release and controlled centre access.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              Admin authorities publish encrypted papers, blockchain stores the release policy,
              and examination centres unlock only at authorized time with NFT + decryption key validation.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
                <p className="text-xs text-zinc-400">Encryption</p>
                <p className="text-sm font-semibold text-zinc-100">AES end-to-end</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
                <p className="text-xs text-zinc-400">Access control</p>
                <p className="text-sm font-semibold text-zinc-100">NFT + role gated</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
                <p className="text-xs text-zinc-400">Audit trail</p>
                <p className="text-sm font-semibold text-zinc-100">On-chain events</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="soft-glow inline-flex items-center gap-2 rounded-2xl bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Launch Secure Workflow
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-300">
                Chain: Polygon Amoy
              </span>
            </div>
          </article>

          <article className="glass hover-lift fade-in-up fade-delay-2 rounded-2xl p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Why this matters</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-zinc-100">
                  <Fingerprint className="h-4 w-4 text-(--gov-cyan)" />
                  <p className="font-medium">Traceable accountability</p>
                </div>
                <p className="mt-1 text-zinc-400">Every upload and release action is tied to a wallet and preserved in immutable logs.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-zinc-100">
                  <TimerReset className="h-4 w-4 text-(--gov-gold)" />
                  <p className="font-medium">Strict timing control</p>
                </div>
                <p className="mt-1 text-zinc-400">Release schedule is enforced on-chain to prevent early disclosure and manual overrides.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-zinc-100">
                  <BadgeCheck className="h-4 w-4 text-(--gov-crimson)" />
                  <p className="font-medium">Targeted centre access</p>
                </div>
                <p className="mt-1 text-zinc-400">Only centres with minted access NFTs and valid keys can decrypt assigned papers.</p>
              </div>
            </div>
          </article>
        </div>

        <section className="glass fade-in-up fade-delay-3 rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Operational Sequence</p>
              <h3 className="text-lg font-semibold text-zinc-100 sm:text-xl">End-to-end secure flow</h3>
            </div>
            <span className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">Designed for multi-centre exam boards</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Step 1</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Encrypt and upload</p>
              <p className="mt-1 text-xs text-zinc-400">Authority uploads encrypted file with release timestamp.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Step 2</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Mint centre access</p>
              <p className="mt-1 text-xs text-zinc-400">NFT card is issued to each approved examination centre wallet.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Step 3</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Countdown lock</p>
              <p className="mt-1 text-xs text-zinc-400">Content remains inaccessible until exact scheduled unlock.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Step 4</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Decrypt and print</p>
              <p className="mt-1 text-xs text-zinc-400">Centres use key plus NFT authorization to download original paper.</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass hover-lift rounded-2xl p-4">
            <Building2 className="h-5 w-5 text-(--gov-gold)" />
            <p className="mt-2 text-sm font-medium text-zinc-100">Authority-Controlled Operations</p>
            <p className="mt-1 text-xs text-zinc-400">Role-gated publishing and access grants.</p>
          </div>
          <div className="glass hover-lift rounded-2xl p-4">
            <LockKeyhole className="h-5 w-5 text-(--gov-cyan)" />
            <p className="mt-2 text-sm font-medium text-zinc-100">Encrypted by Default</p>
            <p className="mt-1 text-xs text-zinc-400">Client-side AES pipeline protects paper confidentiality.</p>
          </div>
          <div className="glass hover-lift rounded-2xl p-4">
            <ShieldCheck className="h-5 w-5 text-indigo-300" />
            <p className="mt-2 text-sm font-medium text-zinc-100">Realtime Chain Sync</p>
            <p className="mt-1 text-xs text-zinc-400">Live updates via events and block polling.</p>
          </div>
          <div className="glass hover-lift rounded-2xl p-4">
            <Clock3 className="h-5 w-5 text-(--gov-crimson)" />
            <p className="mt-2 text-sm font-medium text-zinc-100">Timed Release Guard</p>
            <p className="mt-1 text-xs text-zinc-400">Strict unlock windows protect fairness on exam day.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
