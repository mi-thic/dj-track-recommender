import { NextResponse, type NextRequest } from "next/server";

import { duplicateSetlist } from "@/lib/setlists";

import { errorResponse } from "../../respond";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/setlists/:id/duplicate — 「◯◯ のコピー」として複製する */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const setlist = await duplicateSetlist(id);
    if (!setlist) {
      return NextResponse.json({ error: "セットリストが見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ setlist }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "[POST /api/setlists/:id/duplicate]");
  }
}
