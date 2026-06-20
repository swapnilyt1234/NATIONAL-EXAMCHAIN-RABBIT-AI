import { AccessEventStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AccessPayload = {
  contentId?: string;
  ipfsCid?: string;
  centreWallet?: string;
  keyHash?: string;
  status?: AccessEventStatus;
  message?: string;
  downloadedFile?: string;
};

const allowedStatus = new Set<AccessEventStatus>([
  AccessEventStatus.SUCCESS,
  AccessEventStatus.DENIED_NO_NFT,
  AccessEventStatus.DENIED_LOCKED,
  AccessEventStatus.DENIED_NO_KEY,
  AccessEventStatus.FAILED,
]);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AccessPayload;

    if (!payload.status || !allowedStatus.has(payload.status)) {
      return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
    }

    const record = await prisma.accessRecord.create({
      data: {
        contentId: payload.contentId?.trim() || null,
        ipfsCid: payload.ipfsCid?.trim() || null,
        centreWallet: payload.centreWallet?.trim() || null,
        keyHash: payload.keyHash?.trim() || null,
        status: payload.status,
        message: payload.message?.trim() || null,
        downloadedFile: payload.downloadedFile?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch {
    return NextResponse.json({ error: "Failed to store access record." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const centreWallet = searchParams.get("centreWallet")?.trim();
    const keyHash = searchParams.get("keyHash")?.trim();
    const status = searchParams.get("status")?.trim() as AccessEventStatus | null;
    const takeParam = Number(searchParams.get("take") ?? "200");
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 1000) : 200;

    const records = await prisma.accessRecord.findMany({
      where: {
        ...(centreWallet ? { centreWallet } : {}),
        ...(keyHash ? { keyHash } : {}),
        ...(status && allowedStatus.has(status) ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: "Failed to load access records." }, { status: 500 });
  }
}
