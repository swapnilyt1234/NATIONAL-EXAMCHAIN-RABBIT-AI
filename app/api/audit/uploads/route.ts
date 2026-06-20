import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type UploadPayload = {
  contentId?: string;
  ipfsCid?: string;
  releaseAt?: string;
  adminWallet?: string;
  txHash?: string;
  chainName?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as UploadPayload;

    if (!payload.ipfsCid || payload.ipfsCid.trim().length === 0) {
      return NextResponse.json({ error: "ipfsCid is required." }, { status: 400 });
    }

    if (!payload.releaseAt) {
      return NextResponse.json({ error: "releaseAt is required." }, { status: 400 });
    }

    const releaseAt = new Date(payload.releaseAt);
    if (Number.isNaN(releaseAt.getTime())) {
      return NextResponse.json({ error: "releaseAt must be a valid ISO date." }, { status: 400 });
    }

    const record = await prisma.uploadRecord.create({
      data: {
        contentId: payload.contentId?.trim() || null,
        ipfsCid: payload.ipfsCid.trim(),
        releaseAt,
        adminWallet: payload.adminWallet?.trim() || null,
        txHash: payload.txHash?.trim() || null,
        chainName: payload.chainName?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch {
    return NextResponse.json({ error: "Failed to store upload record." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const records = await prisma.uploadRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: "Failed to load upload records." }, { status: 500 });
  }
}
