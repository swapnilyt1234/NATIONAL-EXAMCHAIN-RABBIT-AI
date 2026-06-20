"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWatchBlockNumber,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { abi, contractAddress } from "@/lib/contract";

const CHAIN_GAS_CAP = 33_000_000n;
const GAS_BUFFER_NUMERATOR = 12n;
const GAS_BUFFER_DENOMINATOR = 10n;
const MIN_TX_GAS = 21_000n;
const MIN_PRIORITY_FEE_WEI = 25_000_000_000n;
const FALLBACK_MAX_FEE_WEI = 45_000_000_000n;

const FALLBACK_GAS_LIMITS = {
  uploadContent: 700_000n,
  approveContent: 250_000n,
  finalizeContent: 250_000n,
  mintAccessNFT: 450_000n,
} as const;

export type EduContentItem = {
  id: bigint;
  ipfsHash: string;
  approvals: bigint;
  releaseTime: bigint;
  released: boolean;
  hasAccess: boolean;
};

type TxState = {
  txHash?: Hex;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
};

function useWriteAction() {
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsSubmitting(false);
    setLocalError(null);
  }, []);

  const execute = useCallback(
    async (
      functionName: "uploadContent" | "approveContent" | "finalizeContent" | "mintAccessNFT",
      args: readonly unknown[],
    ) => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected. Connect your wallet and retry.");
      }

      setLocalError(null);
      setIsSubmitting(true);

      try {
        let gas: bigint | undefined;
        let maxPriorityFeePerGas: bigint | undefined;
        let maxFeePerGas: bigint | undefined;

        if (publicClient && address) {
          try {
            const estimatedGas = await publicClient.estimateContractGas({
              address: contractAddress,
              abi,
              functionName: functionName as never,
              args: args as never,
              account: address,
            });

            const bufferedGas = (estimatedGas * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR;
            gas = bufferedGas < MIN_TX_GAS ? MIN_TX_GAS : bufferedGas;
            if (gas > CHAIN_GAS_CAP) {
              gas = CHAIN_GAS_CAP;
            }
          } catch {
            gas = FALLBACK_GAS_LIMITS[functionName];
          }

          try {
            const estimatedFees = await publicClient.estimateFeesPerGas();

            const estimatedPriorityFee =
              typeof estimatedFees.maxPriorityFeePerGas === "bigint"
                ? estimatedFees.maxPriorityFeePerGas
                : 0n;

            maxPriorityFeePerGas =
              estimatedPriorityFee < MIN_PRIORITY_FEE_WEI ? MIN_PRIORITY_FEE_WEI : estimatedPriorityFee;

            const estimatedMaxFee =
              typeof estimatedFees.maxFeePerGas === "bigint" ? estimatedFees.maxFeePerGas : 0n;

            const minMaxFee = maxPriorityFeePerGas * 2n;
            maxFeePerGas = estimatedMaxFee < minMaxFee ? minMaxFee : estimatedMaxFee;
          } catch {
            maxPriorityFeePerGas = MIN_PRIORITY_FEE_WEI;
            maxFeePerGas = FALLBACK_MAX_FEE_WEI;
          }
        } else {
          gas = FALLBACK_GAS_LIMITS[functionName];
          maxPriorityFeePerGas = MIN_PRIORITY_FEE_WEI;
          maxFeePerGas = FALLBACK_MAX_FEE_WEI;
        }

        const hash = await writeContractAsync({
          address: contractAddress,
          abi,
          functionName: functionName as never,
          args: args as never,
          ...(gas ? { gas } : {}),
          ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
          ...(maxFeePerGas ? { maxFeePerGas } : {}),
        } as any);

        setTxHash(hash);
        return hash;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error("Transaction failed.");
        if (/rate limit|rate-limited|too many requests|429/i.test(normalized.message)) {
          const retryMessage =
            "RPC is rate-limiting requests. Wait 20-30 seconds and retry. For stable writes, use a dedicated Amoy RPC URL in NEXT_PUBLIC_AMOY_RPC_URL.";
          const wrapped = new Error(retryMessage);
          setLocalError(wrapped);
          throw wrapped;
        }
        setLocalError(normalized);
        throw normalized;
      } finally {
        setIsSubmitting(false);
      }
    },
    [address, isConnected, publicClient, writeContractAsync],
  );

  const state: TxState = {
    txHash,
    isLoading: isSubmitting || receipt.isLoading,
    isSuccess: receipt.isSuccess,
    isError: Boolean(localError) || receipt.isError,
    error: localError ?? (receipt.error as Error | null) ?? null,
  };

  return { execute, reset, ...state };
}

export function useUploadContent() {
  const { execute, reset, ...state } = useWriteAction();

  const uploadContent = useCallback(
    async (ipfsHash: string, releaseTime: bigint) => {
      return execute("uploadContent", [ipfsHash, releaseTime]);
    },
    [execute],
  );

  return { uploadContent, reset, ...state };
}

export function useApproveContent() {
  const { execute, reset, ...state } = useWriteAction();

  const approveContent = useCallback(
    async (contentId: bigint) => {
      return execute("approveContent", [contentId]);
    },
    [execute],
  );

  return { approveContent, reset, ...state };
}

export function useMintAccessNFT() {
  const { execute, reset, ...state } = useWriteAction();

  const mintAccessNFT = useCallback(
    async (student: Address, contentId: bigint) => {
      return execute("mintAccessNFT", [student, contentId]);
    },
    [execute],
  );

  return { mintAccessNFT, reset, ...state };
}

export function useFinalizeContent() {
  const { execute, reset, ...state } = useWriteAction();

  const finalizeContent = useCallback(
    async (contentId: bigint) => {
      return execute("finalizeContent", [contentId]);
    },
    [execute],
  );

  return { finalizeContent, reset, ...state };
}

export function useGetContent() {
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{ ipfsHash: string; releaseTime: bigint } | null>(null);

  const getContent = useCallback(
    async (contentId: bigint) => {
      if (!publicClient) throw new Error("Public client unavailable.");
      if (!isConnected || !address) throw new Error("Wallet not connected. Connect your wallet to read content.");

      setIsLoading(true);
      setIsSuccess(false);
      setError(null);

      try {
        const result = (await publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: "getContent",
          args: [contentId],
          account: address,
        } as any)) as [string, bigint];

        const [ipfsHash, releaseTime] = result;

        const payload = { ipfsHash, releaseTime };
        setData(payload);
        setIsSuccess(true);
        return payload;
      } catch (readError) {
        const normalized = readError instanceof Error ? readError : new Error("Failed to read content.");
        setError(normalized);
        throw normalized;
      } finally {
        setIsLoading(false);
      }
    },
    [address, isConnected, publicClient],
  );

  return {
    getContent,
    data,
    isLoading,
    isSuccess,
    isError: Boolean(error),
    error,
  };
}

export function useContentList(refreshMs = 15000) {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const [items, setItems] = useState<EduContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient || contractAddress === "0x0000000000000000000000000000000000000000") {
      setItems([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const contentIds = (await publicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "getAllContentIds",
      } as any)) as bigint[];

      if (!contentIds.length) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      const records = await Promise.all(
        contentIds.map(async (id) => {
          const pending = (await publicClient.readContract({
            address: contractAddress,
            abi,
            functionName: "getPendingContent",
            args: [id],
          } as any)) as {
            ipfsHash: string;
            approvals: bigint;
            releaseTime: bigint;
            released: boolean;
          };

          let hasAccess = false;
          if (address) {
            hasAccess = (await publicClient.readContract({
              address: contractAddress,
              abi,
              functionName: "hasContentAccess",
              args: [id, address],
            } as any)) as boolean;
          }

          return {
            id,
            ipfsHash: pending.ipfsHash,
            approvals: pending.approvals,
            releaseTime: pending.releaseTime,
            released: pending.released,
            hasAccess,
          } satisfies EduContentItem;
        }),
      );

      setItems(records.sort((a, b) => Number(b.id - a.id)));
    } catch (readError) {
      const normalized = readError instanceof Error ? readError : new Error("Failed to load content list.");
      setError(normalized);
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useWatchBlockNumber({
    enabled: Boolean(publicClient),
    onBlockNumber: () => {
      void refresh();
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, refreshMs);

    return () => clearInterval(timer);
  }, [refresh, refreshMs]);

  return {
    items,
    isLoading,
    isError: Boolean(error),
    error,
    refresh,
  };
}

type EventOptions = {
  onContentUploaded?: (contentId: bigint) => void;
  onContentReleased?: () => void;
  onAccessGranted?: () => void;
};

export function useEduEventListeners(options?: EventOptions) {
  const callbacks = useMemo(
    () => ({
      onContentUploaded: options?.onContentUploaded,
      onContentReleased: options?.onContentReleased,
      onAccessGranted: options?.onAccessGranted,
    }),
    [options?.onAccessGranted, options?.onContentReleased, options?.onContentUploaded],
  );

  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: "ContentUploaded",
    onLogs: (logs) => {
      const latest = logs[logs.length - 1] as { args?: { contentId?: bigint } } | undefined;
      const contentId = latest?.args?.contentId;
      if (typeof contentId === "bigint") {
        callbacks.onContentUploaded?.(contentId);
      }
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: "ContentReleased",
    onLogs: () => {
      callbacks.onContentReleased?.();
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: "AccessGranted",
    onLogs: () => {
      callbacks.onAccessGranted?.();
    },
  });
}
