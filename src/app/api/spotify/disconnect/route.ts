import { NextResponse } from "next/server";

import { disconnectAccount } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

/** POST /api/spotify/disconnect — 保存したトークンを削除する（曲の紐付けは残す） */
export async function POST() {
  try {
    await disconnectAccount();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/spotify/disconnect]", error);
    return NextResponse.json({ error: "連携解除に失敗しました" }, { status: 500 });
  }
}
