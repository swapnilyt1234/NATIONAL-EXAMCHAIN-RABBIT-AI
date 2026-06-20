import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type QueryParams = {
  centreWallet?: string;
  onlyReleased?: string;
  take?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const centreWallet = searchParams.get("centreWallet");
    const onlyReleased = searchParams.get("onlyReleased") === "true";
    const take = Math.min(parseInt(searchParams.get("take") || "100", 10), 500);

    const query: any = {};

    // Filter by release time if requested
    if (onlyReleased) {
      query.releaseAt = { lte: new Date() };
    }

    const papers = await prisma.uploadRecord.findMany({
      where: query,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        contentId: true,
        ipfsCid: true,
        releaseAt: true,
        adminWallet: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ papers });
  } catch (error) {
    console.error("Failed to fetch papers:", error);
    return NextResponse.json({ error: "Failed to load papers." }, { status: 500 });
  }
}
