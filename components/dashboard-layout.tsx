"use client";

import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { ArrowLeft, Activity, BarChart3, Database, Lock, Shield, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount, usePublicClient, useWatchBlockNumber } from "wagmi";
import { abi, contractAddress } from "@/lib/contract";

type DashboardLayoutProps = {
  adminPanel: ReactNode;
  centrePanel: ReactNode;
};

export default function DashboardLayout({ adminPanel, centrePanel }: DashboardLayoutProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [activePanel, setActivePanel] = useState<"admin" | "centre">("admin");
  const [role, setRole] = useState<"unknown" | "admin" | "centre" | "none">("unknown");
  const adminPanelRef = useRef<HTMLDivElement>(null);
  const centrePanelRef = useRef<HTMLDivElement>(null);

  const resolveRole = useCallback(async () => {
    if (!publicClient || !address || contractAddress === "0x0000000000000000000000000000000000000000") {
      setRole("unknown");
      return;
    }

    try {
      const adminRole = (await publicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "ADMIN_ROLE",
      } as any)) as `0x${string}`;

      const examCenterRole = (await publicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "EXAM_CENTER_ROLE",
      } as any)) as `0x${string}`;

      const [isAdmin, isExamCenter] = (await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: "hasRole",
          args: [adminRole, address],
        } as any),
        publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: "hasRole",
          args: [examCenterRole, address],
        } as any),
      ])) as [boolean, boolean];

      if (isAdmin) {
        setRole("admin");
      } else if (isExamCenter) {
        setRole("centre");
      } else {
        setRole("none");
      }
    } catch {
      setRole("unknown");
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (!address) {
      setRole("unknown");
      return;
    }
    void resolveRole();
  }, [address, resolveRole]);

  useWatchBlockNumber({
    enabled: Boolean(address && publicClient),
    onBlockNumber: () => {
      void resolveRole();
    },
  });

  const canViewAdmin = !address || role === "admin";
  const canViewCentre = !address || role === "admin" || role === "centre";

  useEffect(() => {
    if (!address) return;
    if (role === "centre") {
      setActivePanel("centre");
      return;
    }
    if (role === "admin") {
      setActivePanel("admin");
    }
  }, [address, role]);

  const focusPanel = (panel: "admin" | "centre") => {
    setActivePanel(panel);

    const targetRef = panel === "admin" ? adminPanelRef : centrePanelRef;
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="gov-grid pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-lg rounded-2xl p-6 lg:sticky lg:top-6 lg:h-fit"
        >
          {/* Brand Header */}
          <div className="mb-8 flex items-start gap-3">
            <div className="soft-glow rounded-xl bg-linear-to-br from-cyan-950 to-blue-950 p-3">
              <Shield className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">National ExamChain</p>
            <h1 className="text-2xl font-black accent-gradient">Operations Console</h1>
            <p className="mt-1 text-xs text-zinc-400">Government Blockchain Control</p>
            </div>
          </div>

          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:border-white/25"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Landing
          </Link>

          {/* Navigation */}
          <nav className="mb-8 grid gap-3 text-sm lg:grid-cols-1">
            {canViewAdmin && (
            <motion.button
              type="button"
              onClick={() => focusPanel("admin")}
              whileHover={{ x: 4 }}
              className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-all ${
                activePanel === "admin"
                  ? "border border-cyan-500/40 bg-linear-to-r from-cyan-950/60 to-transparent text-cyan-100"
                  : "border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className="flex-1">Admin Publishing</span>
              {activePanel === "admin" && (
                <motion.div
                  layoutId="active-indicator"
                  className="h-2 w-2 rounded-full bg-cyan-400"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </motion.button>
            )}

            {canViewCentre && (
            <motion.button
              type="button"
              onClick={() => focusPanel("centre")}
              whileHover={{ x: 4 }}
              className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-all ${
                activePanel === "centre"
                  ? "border border-purple-500/40 bg-linear-to-r from-purple-950/60 to-transparent text-purple-100"
                  : "border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span className="flex-1">Centre Vault</span>
              {activePanel === "centre" && (
                <motion.div
                  layoutId="active-indicator"
                  className="h-2 w-2 rounded-full bg-purple-400"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </motion.button>
            )}
          </nav>

          {/* System Status Cards */}
          <div className="space-y-3 border-t border-white/10 pt-6">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-xs font-semibold uppercase text-emerald-300">System Status</p>
              </div>
              <p className="text-xs text-emerald-200">All systems operational</p>
            </div>

            <div className="rounded-lg border border-blue-500/30 bg-blue-950/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-blue-400" />
                <p className="text-xs font-semibold uppercase text-blue-300">Network</p>
              </div>
              <p className="text-xs text-blue-200">Polygon Amoy: Connected</p>
            </div>

            <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Security Model</p>
              <p className="mt-1 text-xs leading-relaxed text-cyan-200">NFT-gated, encrypted papers, timed release, audit logged.</p>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <section className="space-y-6">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="glass-lg rounded-2xl px-6 py-5"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Government Blockchain Control</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Exam Security Command Centre</h2>
                <p className="mt-1 text-sm text-zinc-400">Manage uploads, authorize centres, and orchestrate secure exam delivery</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 sm:flex">
                  <BarChart3 className="h-4 w-4 text-cyan-400" />
                  <div className="text-right text-xs">
                    <p className="text-zinc-400">Live Status</p>
                    <p className="font-semibold text-green-400">Active</p>
                  </div>
                </div>
                <ConnectButton accountStatus="address" chainStatus="name" showBalance={false} />
              </div>
            </div>
          </motion.header>

          {/* Panels Grid */}
          <div className={`grid gap-6 ${canViewAdmin && canViewCentre ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
            {canViewAdmin && (
            <div ref={adminPanelRef}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
              >
                {adminPanel}
              </motion.div>
            </div>
            )}
            {canViewCentre && (
            <div ref={centrePanelRef}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
              >
                {centrePanel}
              </motion.div>
            </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
