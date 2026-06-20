"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Download, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { decryptFileWithMetadata } from "@/lib/encryption";
import { fetchFromIPFS } from "@/lib/ipfs";
import { useContentList, useEduEventListeners, useGetContent } from "@/hooks/useEduContract";

type VaultItem = {
  id: bigint;
  cid: string;
  releaseAt: number;
  released: boolean;
  hasAccess: boolean;
};

type StoredPaper = {
  id: string;
  contentId: string | null;
  ipfsCid: string;
  releaseAt: Date;
};

type AccessRecord = {
  id: string;
  createdAt: string;
  contentId: string | null;
  status: "SUCCESS" | "DENIED_NO_NFT" | "DENIED_LOCKED" | "DENIED_NO_KEY" | "FAILED";
  message: string | null;
  downloadedFile: string | null;
  keyHash: string | null;
};

function formatCountdown(targetTs: number): string {
  const ms = Math.max(targetTs - Date.now(), 0);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function statusLabel(status: AccessRecord["status"]): string {
  if (status === "SUCCESS") return "Unlocked";
  if (status === "DENIED_LOCKED") return "Blocked (timed lock)";
  if (status === "DENIED_NO_KEY") return "Blocked (key missing)";
  if (status === "DENIED_NO_NFT") return "Blocked (NFT missing)";
  return "Failed";
}

export default function StudentVault() {
  const { address } = useAccount();
  const [decryptionKey, setDecryptionKey] = useState("");
  const [now, setNow] = useState(Date.now());
  const [consumedContentIds, setConsumedContentIds] = useState<Set<string>>(new Set());
  const [historyRecords, setHistoryRecords] = useState<AccessRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [invalidKeyPaperIds, setInvalidKeyPaperIds] = useState<Set<string>>(new Set());
  const [storedPapers, setStoredPapers] = useState<StoredPaper[]>([]);
  const [storedPapersLoading, setStoredPapersLoading] = useState(false);

  const { items: chainItems, isLoading, refresh } = useContentList(12000);
  const { getContent, isLoading: getContentLoading } = useGetContent();

  const items: VaultItem[] = useMemo(
    () =>
      chainItems.map((item) => ({
        id: item.id,
        cid: item.ipfsHash,
        releaseAt: Number(item.releaseTime) * 1000,
        released: item.released,
        hasAccess: item.hasAccess,
      })),
    [chainItems],
  );

  const assignedItems = useMemo(() => {
    // Include blockchain items that have access
    const blockchainItems = items.filter((item) => item.hasAccess);
    
    // Also include stored papers not already in blockchain items
    const blockchainIds = new Set(blockchainItems.map((item) => item.id.toString()));
    const storedItems = storedPapers
      .filter((paper) => paper.contentId && !blockchainIds.has(paper.contentId))
      .map((paper) => ({
        id: BigInt(paper.contentId || "0"),
        cid: paper.ipfsCid,
        releaseAt: new Date(paper.releaseAt).getTime(),
        released: new Date(paper.releaseAt) <= new Date(),
        hasAccess: true, // Assume access since it's in the db
      }) as VaultItem);
    
    return [...blockchainItems, ...storedItems];
  }, [items, storedPapers]);

  useEduEventListeners({
    onAccessGranted: () => {
      toast.success("New access NFT detected.");
      void refresh();
    },
    onContentReleased: () => {
      toast.success("A content item has been released.");
      void refresh();
    },
  });

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
    };
  }, []);

  // Reset invalid key tracking when key changes
  useEffect(() => {
    setInvalidKeyPaperIds(new Set());
  }, [decryptionKey]);

  const downloadableCount = useMemo(
    () => assignedItems.filter((item) => item.released && item.releaseAt <= now && !consumedContentIds.has(item.id.toString())).length,
    [assignedItems, now, consumedContentIds],
  );

  const downloadedCount = consumedContentIds.size;

  const hashDecryptionKey = useCallback(async (rawKey: string) => {
    const normalized = rawKey.trim();
    if (!normalized) return null;

    const encoder = new TextEncoder();
    const bytes = encoder.encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }, []);

  const loadHistoryRecords = useCallback(async () => {
    if (!address) {
      setHistoryRecords([]);
      setConsumedContentIds(new Set());
      return;
    }

    setHistoryLoading(true);
    try {
      const response = await fetch(
        `/api/audit/accesses?centreWallet=${encodeURIComponent(address)}&status=SUCCESS&take=500`,
      );
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { records?: AccessRecord[] };
      const records = payload.records ?? [];
      setHistoryRecords(records);

      const usedIds = new Set(
        records
          .filter((record) => Boolean(record.contentId))
          .map((record) => record.contentId as string),
      );
      setConsumedContentIds(usedIds);
    } catch {
      // Keep unlock flow usable even if history cannot be loaded.
    } finally {
      setHistoryLoading(false);
    }
  }, [address]);

  const loadStoredPapers = useCallback(async () => {
    setStoredPapersLoading(true);
    try {
      const response = await fetch(`/api/audit/papers?onlyReleased=true&take=500`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { papers?: StoredPaper[] };
      const papers = payload.papers ?? [];
      setStoredPapers(papers);
    } catch {
      // Keep flow usable even if stored papers cannot be loaded.
    } finally {
      setStoredPapersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistoryRecords();
    void loadStoredPapers();
  }, [loadHistoryRecords, loadStoredPapers]);

  useEffect(() => {
    if (!address) return;
    void refresh();
    void loadHistoryRecords();
    void loadStoredPapers();
  }, [address, loadHistoryRecords, loadStoredPapers, refresh]);

  const persistAccessRecord = async (payload: {
    contentId: string;
    ipfsCid: string;
    status: "SUCCESS" | "DENIED_NO_NFT" | "DENIED_LOCKED" | "DENIED_NO_KEY" | "FAILED";
    message?: string;
    downloadedFile?: string;
    keyHash?: string | null;
  }) => {
    try {
      await fetch("/api/audit/accesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: payload.contentId,
          ipfsCid: payload.ipfsCid,
          centreWallet: address ?? null,
          keyHash: payload.keyHash ?? null,
          status: payload.status,
          message: payload.message,
          downloadedFile: payload.downloadedFile,
        }),
      });
    } catch {
      // Audit write failures should not block vault access UX.
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
      className="space-y-6"
    >
      {/* Header with Metrics */}
      <div className="glass-lg rounded-2xl border border-purple-500/20 p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-400 pulse-glow" />
              <p className="text-xs font-bold uppercase tracking-widest text-purple-300">Examination Centre Vault</p>
            </div>
            <h3 className="text-2xl font-bold text-white">Exam Access Cards</h3>
            <p className="mt-2 text-sm text-zinc-300">Only NFT-assigned papers are shown here. Paste the key to unlock and download once.</p>
          </div>

          {/* Metrics Cards */}
          <div className="flex gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase text-cyan-300">Ready to Download</p>
              <motion.p
                key={downloadableCount}
                initial={{ scale: 0.8, y: 4 }}
                animate={{ scale: 1, y: 0 }}
                className="mt-1 text-2xl font-bold text-cyan-200"
              >
                {downloadableCount}
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase text-emerald-300">Downloaded</p>
              <p className="mt-1 text-2xl font-bold text-emerald-200">{downloadedCount}</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Requirements Banner */}
      <div className="rounded-xl border border-white/10 bg-linear-to-r from-white/5 to-white/3 p-4 backdrop-blur-sm sm:p-5">
        <p className="mb-3 text-xs font-bold uppercase text-cyan-300">Access Requirements</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-400" />
            <span className="text-sm text-zinc-300">Valid Access NFT</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-400" />
            <span className="text-sm text-zinc-300">Release Time Passed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-zinc-300">Valid Decryption Key</span>
          </div>
        </div>
      </div>

      {/* Decryption Key Input */}
      <div className="glass-metrics rounded-2xl border border-cyan-500/20 p-6">
        <label className="mb-3 block">
          <p className="text-sm font-bold uppercase text-cyan-300">Global Decryption Key</p>
          <p className="mt-1 text-xs text-zinc-400">Paste your exam centre decryption key to unlock papers</p>
        </label>
        <Input
          value={decryptionKey}
          onChange={(event) => setDecryptionKey(event.target.value)}
          placeholder="Paste exam centre decryption key here..."
          className="border-cyan-500/30 bg-cyan-950/20 placeholder:text-zinc-600 focus:border-cyan-400 focus:ring-cyan-500/20"
        />
        <p className="mt-2 text-xs text-zinc-500">🔐 Key is used client-side only. Never transmitted or stored on-chain.</p>
      </div>

      {/* Available Papers Section */}
      <div className="glass-lg rounded-2xl border border-cyan-500/20 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold text-white">Available Exam Papers</h4>
            <p className="mt-1 text-xs text-zinc-400">Papers ready to download with your decryption key</p>
          </div>
        </div>

        {/* Papers Grid */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : assignedItems.filter((item) => !consumedContentIds.has(item.id.toString())).length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center"
          >
            <LockKeyhole className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-300">All papers downloaded</p>
            <p className="mt-1 text-xs text-zinc-500">Check the History section below to view your downloaded papers</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {assignedItems
                .filter((item) => !consumedContentIds.has(item.id.toString()))
                .map((item, index) => {
                  const unlocked = item.released && item.releaseAt <= now;
                  const countdown = formatCountdown(item.releaseAt);
                  const releaseDate = formatTime(new Date(item.releaseAt).toISOString());

                  return (
                    <motion.article
                      key={item.id.toString()}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all ${
                        unlocked
                          ? "border-cyan-500/40 bg-linear-to-r from-cyan-950/60 to-blue-950/60"
                          : "border-white/15 bg-white/5"
                      }`}
                    >
                      {/* Glow Effect */}
                      {unlocked && (
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 via-transparent to-blue-500/10" />
                        </div>
                      )}

                      <div className="relative p-4">
                        <div className="flex flex-col gap-4">
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-mono text-lg font-bold text-white">Paper #{item.id.toString()}</h4>
                            </div>
                            <motion.div
                              animate={{
                                rotate: unlocked ? 12 : 0,
                              }}
                              transition={{ duration: 0.4 }}
                            >
                              {unlocked ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-300 glow-cyan whitespace-nowrap">
                                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                  Ready to Download
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-semibold text-yellow-300 whitespace-nowrap">
                                  <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-yellow-400" />
                                  Locked
                                </span>
                              )}
                            </motion.div>
                          </div>

                          {/* IPFS & Release Info */}
                          <div className="space-y-2">
                            <p className="break-all font-mono text-xs text-zinc-400">IPFS:&nbsp;{item.cid.slice(0, 12)}...{item.cid.slice(-6)}</p>

                            <div className="flex items-start gap-6">
                              <div>
                                <p className="text-xs text-zinc-500">Release Date</p>
                                <p className="text-xs font-medium text-zinc-300">{releaseDate}</p>
                              </div>
                              {!unlocked && (
                                <div>
                                  <p className="text-xs text-zinc-500">Time Until Release</p>
                                  <p className="font-mono text-sm font-bold text-yellow-300">{countdown}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          {unlocked ? (
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                disabled={!decryptionKey || getContentLoading || invalidKeyPaperIds.has(item.id.toString())}
                                onClick={async () => {
                                  if (!decryptionKey) {
                                    toast.error("Enter your decryption key first.");
                                    return;
                                  }

                                  try {
                                    const keyHash = await hashDecryptionKey(decryptionKey);
                                    const onchain = await getContent(item.id);
                                    const encryptedPayload = await fetchFromIPFS(onchain.ipfsHash);
                                    
                                    // Try to decrypt with the provided key
                                    // If decryption fails, the key is wrong for this paper
                                    let decrypted;
                                    try {
                                      decrypted = decryptFileWithMetadata(encryptedPayload, decryptionKey);
                                    } catch (decryptError) {
                                      toast.error("Incorrect key for this paper. Please enter the correct decryption key.");
                                      setInvalidKeyPaperIds((prev) => new Set(prev).add(item.id.toString()));
                                      await persistAccessRecord({
                                        contentId: item.id.toString(),
                                        ipfsCid: item.cid,
                                        status: "DENIED_NO_KEY",
                                        message: `Decryption failed - incorrect key. Error: ${decryptError instanceof Error ? decryptError.message : "Unknown error"}`,
                                        keyHash,
                                      });
                                      return;
                                    }

                                    const url = URL.createObjectURL(decrypted.blob);
                                    const anchor = document.createElement("a");
                                    anchor.href = url;
                                    anchor.download = decrypted.name;
                                    document.body.appendChild(anchor);
                                    anchor.click();
                                    anchor.remove();
                                    URL.revokeObjectURL(url);

                                    await persistAccessRecord({
                                      contentId: item.id.toString(),
                                      ipfsCid: item.cid,
                                      status: "SUCCESS",
                                      message: "Exam downloaded and decrypted.",
                                      downloadedFile: decrypted.name,
                                      keyHash,
                                    });
                                    setConsumedContentIds((prev) => {
                                      const next = new Set(prev);
                                      next.add(item.id.toString());
                                      return next;
                                    });
                                    await loadHistoryRecords();
                                    toast.success(`Downloaded exam #${item.id.toString()}`);
                                  } catch (error) {
                                    const message = error instanceof Error ? error.message : "Failed to fetch content.";
                                    const keyHash = await hashDecryptionKey(decryptionKey);
                                    await persistAccessRecord({
                                      contentId: item.id.toString(),
                                      ipfsCid: item.cid,
                                      status: "FAILED",
                                      message,
                                      keyHash,
                                    });
                                    await loadHistoryRecords();
                                    toast.error(message);
                                  }
                                }}
                                className="gap-2 w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-semibold py-3"
                              >
                                <Download className="h-5 w-5" />
                                {invalidKeyPaperIds.has(item.id.toString()) ? "Invalid Key" : getContentLoading ? "Downloading..." : "Download Paper"}
                              </Button>
                              {!decryptionKey && (
                                <p className="text-xs text-cyan-300 text-center">👇 Enter the decryption key above to enable download</p>
                              )}
                              {decryptionKey && invalidKeyPaperIds.has(item.id.toString()) && (
                                <p className="text-xs text-red-400 text-center">❌ Invalid key for this paper</p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
                              <p className="text-xs text-yellow-300 font-semibold">⏳ Paper locked until release time</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

      {/* Download History Section */}
      <div className="glass-lg rounded-2xl border border-emerald-500/20 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold text-white">History</h4>
            <p className="mt-1 text-xs text-zinc-400">Papers you have successfully downloaded</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => void loadHistoryRecords()}
            disabled={historyLoading}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          >
            Refresh
          </motion.button>
        </div>

        {/* History Papers Grid */}
        {historyLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : Array.from(consumedContentIds).length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center"
          >
            <Download className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-300">No downloads yet</p>
            <p className="mt-1 text-xs text-zinc-500">Download papers from the Available Exam Papers section above</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {assignedItems
                .filter((item) => consumedContentIds.has(item.id.toString()))
                .map((item, index) => {
                  const downloadedRecord = historyRecords.find((r) => r.contentId === item.id.toString());
                  const downloadedAt = downloadedRecord ? formatTime(downloadedRecord.createdAt) : "Unknown";
                  
                  return (
                    <motion.div
                      key={item.id.toString()}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group relative overflow-hidden rounded-xl border border-emerald-500/40 bg-linear-to-r from-emerald-950/70 via-emerald-950/50 to-teal-950/50 p-4 hover:from-emerald-950/90 hover:to-teal-950/70 transition-all hover:border-emerald-400/60 glow-emerald"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">Downloaded</span>
                          </div>
                          <p className="font-mono text-lg font-bold text-emerald-100 break-all leading-tight">#{item.id.toString()}</p>
                          <div className="mt-3 space-y-1 text-xs text-zinc-400">
                            <p>IPFS: <span className="text-zinc-500 font-mono">{item.cid.slice(0, 12)}...{item.cid.slice(-6)}</span></p>
                            <p>Downloaded: <span className="text-zinc-300">{downloadedAt}</span></p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.section>
  );
}
