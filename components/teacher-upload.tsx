"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock3, Database, FileLock2, LoaderCircle, Lock, UploadCloud, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { decodeEventLog, isAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { encryptFile, generateKey } from "@/lib/encryption";
import { abi, contractAddress } from "@/lib/contract";
import { uploadToIPFS } from "@/lib/ipfs";
import {
  useContentList,
  useEduEventListeners,
  useMintAccessNFT,
  useUploadContent,
} from "@/hooks/useEduContract";

type UploadStatus = "idle" | "encrypting" | "uploading" | "awaiting" | "scheduled" | "error";
const MIN_RELEASE_LEAD_SECONDS = 300;

const statusLabel: Record<Exclude<UploadStatus, "idle">, string> = {
  encrypting: "Encrypting…",
  uploading: "Uploading…",
  awaiting: "Awaiting approvals",
  scheduled: "Scheduled",
  error: "Upload failed",
};

export default function TeacherUpload() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [releaseTime, setReleaseTime] = useState("");
  const [uploadedContentId, setUploadedContentId] = useState("");
  const [mintContentId, setMintContentId] = useState("");
  const [mintCentreAddress, setMintCentreAddress] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [loadingSkeleton, setLoadingSkeleton] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    uploadContent,
    txHash: uploadTxHash,
    isLoading: uploadTxLoading,
    isSuccess: uploadTxSuccess,
    error: uploadTxError,
  } = useUploadContent();

  const {
    mintAccessNFT,
    txHash: mintTxHash,
    isLoading: mintTxLoading,
    isSuccess: mintTxSuccess,
    error: mintTxError,
  } = useMintAccessNFT();

  const { items, isLoading: listLoading, refresh } = useContentList();

  useEduEventListeners({
    onContentUploaded: (contentId) => {
      const id = contentId.toString();
      setUploadedContentId(id);
      setMintContentId(id);
      toast.success(`Content uploaded with ID ${id}`);
      void refresh();
    },
    onContentReleased: () => {
      toast.success("Content released on-chain.");
      void refresh();
    },
    onAccessGranted: () => {
      toast.success("Examination centre access granted.");
      void refresh();
    },
  });

  const canUpload =
    selectedFile !== null &&
    releaseTime.length > 0 &&
    status !== "encrypting" &&
    status !== "uploading" &&
    !uploadTxLoading;

  const statusIcon = useMemo(() => {
    if (status === "encrypting" || status === "uploading") return <LoaderCircle className="h-4 w-4 animate-spin" />;
    if (status === "scheduled") return <CheckCircle2 className="h-4 w-4" />;
    if (status === "awaiting") return <Clock3 className="h-4 w-4" />;
    if (status === "error") return <FileLock2 className="h-4 w-4" />;
    return null;
  }, [status]);

  const persistUploadRecord = async (payload: {
    contentId: string | null;
    ipfsCid: string;
    releaseAt: string;
    txHash: string;
  }) => {
    try {
      await fetch("/api/audit/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: payload.contentId,
          ipfsCid: payload.ipfsCid,
          releaseAt: payload.releaseAt,
          adminWallet: address ?? null,
          txHash: payload.txHash,
          chainName: publicClient?.chain?.name ?? null,
        }),
      });
    } catch {
      // Keep upload UX uninterrupted even if audit persistence fails.
    }
  };

  const runSecureUploadFlow = async () => {
    if (!canUpload) return;

    const releaseTimestamp = Math.floor(new Date(releaseTime).getTime() / 1000);
    const nowTs = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(releaseTimestamp) || releaseTimestamp <= nowTs + MIN_RELEASE_LEAD_SECONDS) {
      toast.error("Release time must be at least 5 minutes in the future.");
      return;
    }

    try {
      setLoadingSkeleton(true);
      setErrorMessage(null);
      setStatus("encrypting");
      setProgress(18);
      toast.info("Encrypting exam content...");

      const generated = generateKey();
      setSessionKey(generated);

      const encrypted = await encryptFile(selectedFile, generated);
      setProgress(50);
      setLoadingSkeleton(false);

      setStatus("uploading");
      toast.info("Uploading encrypted payload to IPFS...");
      const cid = await uploadToIPFS(encrypted);
      setProgress(82);

      const hash = await uploadContent(cid, BigInt(releaseTimestamp));

      let resolvedContentId: string | null = null;

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi,
              data: log.data,
              topics: (log as any).topics,
            });

            if ((decoded as any).eventName === "ContentUploaded") {
              const contentId = ((decoded as any).args as { contentId?: bigint }).contentId;
              if (typeof contentId === "bigint") {
                const id = contentId.toString();
                resolvedContentId = id;
              }
              break;
            }
          } catch {
            // Ignore non-matching logs.
          }
        }

        if (!resolvedContentId) {
          const contentIds = (await publicClient.readContract({
            address: contractAddress,
            abi,
            functionName: "getAllContentIds",
          } as any)) as bigint[];

          for (const contentId of [...contentIds].reverse()) {
            const pending = (await publicClient.readContract({
              address: contractAddress,
              abi,
              functionName: "getPendingContent",
              args: [contentId],
            } as any)) as {
              ipfsHash: string;
              releaseTime: bigint;
            };

            if (pending.ipfsHash === cid && pending.releaseTime === BigInt(releaseTimestamp)) {
              resolvedContentId = contentId.toString();
              break;
            }
          }
        }
      }

      if (resolvedContentId) {
        setUploadedContentId(resolvedContentId);
        setMintContentId(resolvedContentId);
        toast.success(`Content uploaded with ID ${resolvedContentId}`);
      }

      await persistUploadRecord({
        contentId: resolvedContentId,
        ipfsCid: cid,
        releaseAt: new Date(releaseTimestamp * 1000).toISOString(),
        txHash: hash,
      });

      setStatus("scheduled");
      setProgress(100);
      toast.success("Uploaded and registered on-chain.");
      await refresh();
    } catch (error) {
      setStatus("error");
      
      // Friendly error messages for common failures
      let message = "Upload flow failed.";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes("user rejected")) {
          message = "Transaction rejected in MetaMask. Please approve the transaction to continue.";
        } else if (errorMsg.includes("insufficient funds")) {
          message = "Insufficient funds for transaction. Please ensure you have enough balance.";
        } else if (
          errorMsg.includes("invalidreleasetime") ||
          errorMsg.includes("release time") ||
          errorMsg.includes("internal json-rpc error")
        ) {
          message = "Upload failed because release time is in the past or too close to current time. Please set it 5+ minutes ahead and retry.";
        } else if (errorMsg.includes("network")) {
          message = "Network error. Please check your connection and try again.";
        } else if (errorMsg.includes("ipfs")) {
          message = "Failed to upload to IPFS. Please try again.";
        } else if (errorMsg.includes("timeout")) {
          message = "Operation timed out. Please try again.";
        } else {
          message = error.message;
        }
      }
      
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingSkeleton(false);
    }
  };

  const runMintAccessFlow = async () => {
    if (!mintContentId) {
      toast.error("Enter content ID to grant access.");
      return;
    }

    if (!isAddress(mintCentreAddress)) {
      toast.error("Enter a valid examination centre wallet address.");
      return;
    }

    try {
      await mintAccessNFT(mintCentreAddress, BigInt(mintContentId));
      toast.success("Access NFT transaction submitted.");
      await refresh();
    } catch (error) {
      // Friendly error messages for common failures
      let message = "Grant access failed.";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes("user rejected")) {
          message = "Transaction rejected in MetaMask. Please approve to grant access.";
        } else if (errorMsg.includes("insufficient funds")) {
          message = "Insufficient funds for transaction.";
        } else if (errorMsg.includes("network")) {
          message = "Network error. Please check your connection.";
        } else if (errorMsg.includes("invalid")) {
          message = "Invalid address or content ID.";
        } else if (errorMsg.includes("timeout")) {
          message = "Operation timed out. Please try again.";
        } else {
          message = error.message;
        }
      }
      
      toast.error(message);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="glass-lg rounded-2xl px-6 py-5 border border-cyan-500/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 pulse-glow" />
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Admin Zone</p>
            </div>
            <h3 className="text-2xl font-bold text-white">Publish Exam Paper</h3>
            <p className="mt-2 text-sm text-zinc-300">Upload encrypted papers, set unlock timing, and grant centre-specific access cards.</p>
          </div>
          {status !== "idle" && (
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              {statusIcon}
              <span className="text-xs font-medium text-zinc-300">{statusLabel[status as Exclude<UploadStatus, "idle">]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative overflow-hidden rounded-xl border border-red-500/40 bg-linear-to-r from-red-950/80 to-red-900/60 p-4 backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 shrink-0 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                <span className="text-red-400 font-bold text-sm">!</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-300">Upload failed</p>
                {errorMessage && <p className="mt-1 text-sm text-red-200/80">{errorMessage}</p>}
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage(null);
                }}
                className="shrink-0 text-red-400 hover:text-red-300"
              >
                ✕
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Stage Progress */}
      <div className="glass-metrics rounded-2xl border border-cyan-500/20 p-6">
        <h4 className="mb-4 text-sm font-bold uppercase text-cyan-300">Upload Pipeline</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-200">Overall Progress</span>
              <span className="text-xs font-bold text-cyan-400">{progress}%</span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/40 border border-cyan-500/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full bg-linear-to-r from-cyan-500 via-blue-500 to-cyan-500 shadow-lg shadow-cyan-500/50"
                style={{
                  backgroundSize: "200% 100%",
                }}
              />
            </div>
          </div>

          {/* Stage Indicators */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Encrypt", active: progress > 0 && progress <= 50 },
              { label: "Upload", active: progress > 50 && progress < 100 },
              { label: "Register", active: progress === 100 },
            ].map((stage) => (
              <div
                key={stage.label}
                className={`rounded-lg border px-3 py-2 text-center transition-all ${
                  stage.active
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
                    : progress > 0
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                <p className="text-xs font-semibold">{stage.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (!file) {
            toast.error("No file detected.");
            return;
          }
          setSelectedFile(file);
          setSelectedFileName(file.name);
          toast.success(`Selected ${file.name}`);
        }}
        className={`group relative rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all ${
          dragActive
            ? "border-cyan-400 bg-cyan-500/15 shadow-lg shadow-cyan-500/20"
            : "border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400 hover:bg-cyan-500/10"
        }`}
      >
        <motion.div
          animate={{ scale: dragActive ? 1.1 : 1 }}
          transition={{ duration: 0.2 }}
          className="mb-3 flex justify-center"
        >
          <UploadCloud className="h-10 w-10 text-cyan-400" />
        </motion.div>
        <p className="text-base font-semibold text-white">Drop exam file here</p>
        <p className="mt-1 text-sm text-zinc-400">or click to browse</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-500/50 bg-linear-to-r from-cyan-500/20 to-blue-500/20 px-4 py-2 font-medium text-cyan-300 transition hover:border-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30">
          Choose file
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setSelectedFile(file);
              setSelectedFileName(file.name);
              toast.success(`Selected ${file.name}`);
            }}
          />
        </label>
        {selectedFileName && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 inline-block rounded-lg bg-emerald-950/50 px-3 py-1.5 text-sm font-medium text-emerald-300">
            ✓ {selectedFileName}
          </motion.p>
        )}
      </div>

      {/* Release Time Configuration */}
      <div className="glass-metrics rounded-2xl border border-purple-500/20 p-6">
        <label className="mb-3 block">
          <p className="text-sm font-bold uppercase text-purple-300">Release Timestamp</p>
          <p className="mt-1 text-xs text-zinc-400">Centres can only download after this time</p>
        </label>
        <Input
          value={releaseTime}
          onChange={(event) => setReleaseTime(event.target.value)}
          type="datetime-local"
          className="border-purple-500/30 bg-purple-950/20 placeholder:text-zinc-600 focus:border-purple-400 focus:ring-purple-500/20"
        />
      </div>

      {/* Upload Action */}
      <motion.div
        layout
        className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-linear-to-r from-cyan-950/40 to-blue-950/40 p-4"
      >
        <div>
          <p className="text-xs font-bold uppercase text-cyan-300">Ready to upload?</p>
          <p className="mt-1 text-sm text-zinc-400">This will encrypt and register your paper on-chain</p>
        </div>
        <Button
          type="button"
          onClick={runSecureUploadFlow}
          disabled={!canUpload}
          className="gap-2 whitespace-nowrap bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-zinc-700 disabled:to-zinc-700"
        >
          <Zap className="h-4 w-4" />
          {canUpload ? "Upload Paper" : "Select file & time"}
        </Button>
      </motion.div>

      {/* Session Key Display */}
      <AnimatePresence>
        {sessionKey && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-linear-to-r from-emerald-950/80 via-emerald-950/60 to-teal-950/60 p-5 backdrop-blur-sm glow-emerald"
          >
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="font-bold text-emerald-300 uppercase tracking-wide text-sm">🔐 Decryption Key Generated</p>
            </div>
            <p className="mb-4 text-xs text-zinc-300">Share this key securely with the examination centre. Store safely for reference.</p>
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded-lg border border-emerald-500/40 bg-black/60 px-4 py-3 font-mono text-sm font-semibold text-emerald-200 select-all">
                {sessionKey}
              </code>
              <Button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(sessionKey);
                  toast.success("Key copied to clipboard");
                }}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3"
                title="Copy to clipboard"
              >
                📋 Copy
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content ID Display */}
      <AnimatePresence>
        {uploadedContentId && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-xl border border-cyan-500/40 bg-linear-to-r from-cyan-950/60 to-blue-950/60 p-4 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Database className="h-5 w-5 text-cyan-400" />
              <p className="font-bold text-cyan-300">Content ID Assigned</p>
            </div>
            <p className="mb-3 text-xs text-zinc-300">Use this ID to grant access to examination centres</p>
            <code className="block w-full max-w-full break-all whitespace-normal rounded-lg border border-cyan-500/30 bg-black/40 px-3 py-2 font-mono text-sm font-bold leading-relaxed text-cyan-200">
              #{uploadedContentId}
            </code>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction Status */}
      <AnimatePresence>
        {uploadTxHash || uploadTxLoading || uploadTxSuccess || uploadTxError ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={`rounded-xl border px-4 py-3 ${
              uploadTxSuccess
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                : uploadTxError
                  ? "border-red-500/40 bg-red-950/30 text-red-200"
                  : "border-cyan-500/40 bg-cyan-950/30 text-cyan-200"
            }`}
          >
            <div className="flex items-start gap-2 text-xs font-semibold break-words">
              {uploadTxLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {uploadTxSuccess && <CheckCircle2 className="h-4 w-4" />}
              {uploadTxError && <FileLock2 className="h-4 w-4" />}
              {uploadTxLoading && "Confirming on-chain..."}
              {uploadTxSuccess && "Upload confirmed on Polygon"}
              {uploadTxError && <span className="whitespace-pre-wrap break-all">{uploadTxError.message}</span>}
            </div>
            {uploadTxHash && <p className="mt-2 break-all font-mono text-xs opacity-70">Tx: {uploadTxHash}</p>}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Divider */}
      <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

      {/* Access NFT Section */}
      <div className="glass-lg rounded-2xl border border-purple-500/20 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-purple-400" />
          <h4 className="text-lg font-bold text-white">Grant Centre Access</h4>
        </div>
        <p className="mb-4 text-sm text-zinc-400">Mint an NFT to authorize a specific examination centre to access this paper</p>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-purple-300">Content ID</label>
            <Input
              value={mintContentId}
              onChange={(event) => setMintContentId(event.target.value)}
              inputMode="numeric"
              placeholder="e.g., 1"
              className="border-purple-500/30 bg-purple-950/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-purple-300">Centre Wallet Address</label>
            <Input
              value={mintCentreAddress}
              onChange={(event) => setMintCentreAddress(event.target.value)}
              placeholder="0x..."
              className="border-purple-500/30 bg-purple-950/20"
            />
          </div>

          <Button
            type="button"
            onClick={runMintAccessFlow}
            disabled={mintTxLoading}
            className="w-full gap-2 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-zinc-700 disabled:to-zinc-700"
          >
            <Zap className="h-4 w-4" />
            {mintTxLoading ? "Minting..." : "Mint Access NFT"}
          </Button>

          {(mintTxHash || mintTxLoading || mintTxSuccess || mintTxError) && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                mintTxSuccess
                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                  : mintTxError
                    ? "border-red-500/40 bg-red-950/30 text-red-200"
                    : "border-purple-500/40 bg-purple-950/30 text-purple-200"
              } break-words`}
            >
              {mintTxLoading && "Submitting access NFT..."}
              {mintTxSuccess && "✓ Access granted to centre"}
              {mintTxError && <p className="whitespace-pre-wrap break-all">{mintTxError.message}</p>}
              {mintTxHash && <p className="mt-1 break-all font-mono text-xs opacity-70">Tx: {mintTxHash}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Papers List */}
      {!address ? (
        <div className="glass-metrics rounded-2xl border border-cyan-500/20 p-6">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-6 py-12 text-center">
            <Lock className="mx-auto mb-3 h-8 w-8 text-cyan-400" />
            <p className="text-sm font-semibold text-cyan-300">Connect Wallet to View Papers</p>
            <p className="mt-2 text-xs text-zinc-400">Please connect your wallet to view and manage published exam papers.</p>
          </div>
        </div>
      ) : (
        <div className="glass-metrics rounded-2xl border border-white/15 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-white">Published Papers</h4>
              <p className="mt-1 text-xs text-zinc-400">Your most recent exam uploads</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void refresh()}
              disabled={listLoading}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50"
            >
              Refresh
            </motion.button>
          </div>

          {listLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">No papers published yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.slice(0, 5).map((item) => (
                <motion.div
                  key={item.id.toString()}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 4 }}
                  className="group relative overflow-hidden rounded-lg border border-cyan-500/20 bg-linear-to-r from-cyan-950/30 to-transparent px-4 py-4 transition-all hover:border-cyan-500/40 hover:from-cyan-950/50"
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 via-transparent to-transparent" />
                  </div>

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* ID Display */}
                      <p className="font-mono text-xs text-cyan-400/70 mb-2">ID</p>
                      <p className="font-mono text-lg font-bold text-cyan-300 break-all leading-tight">
                        {item.id.toString()}
                      </p>

                      {/* Status Badge */}
                      <div className="mt-3">
                        {item.released ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30"
                          >
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Released
                          </motion.span>
                        ) : (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300 border border-yellow-500/30"
                          >
                            <span className="h-2 w-2 rounded-full animate-pulse bg-yellow-400" />
                            Pending
                          </motion.span>
                        )}
                      </div>
                    </div>

                    {/* Right Column - Approvals & Action */}
                    <div className="flex flex-col items-end justify-start gap-3">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase font-semibold">Approvals</p>
                        <p className="text-2xl font-black text-cyan-300 font-mono">{item.approvals.toString()}</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                      >
                        View
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
