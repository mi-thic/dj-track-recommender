import { NextResponse, type NextRequest } from "next/server";

import { SetlistError } from "@/lib/setlists";

/** ルートハンドラ共通のエラー応答 */
export function errorResponse(error: unknown, label: string) {
  if (error instanceof SetlistError) {
    return NextResponse.json(
      { error: error.message, ...(error.detail ? { detail: error.detail } : {}) },
      { status: error.status },
    );
  }
  console.error(label, error);
  return NextResponse.json({ error: "セットリストの処理に失敗しました" }, { status: 500 });
}

/** JSON ボディを読む。壊れていれば null */
export async function readJson(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
