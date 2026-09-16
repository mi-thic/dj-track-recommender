import { CamelotWheel } from "@/components/CamelotWheel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Camelot ホイール | DJ Track Recommender" };

export default async function CamelotPage() {
  const grouped = await prisma.track.groupBy({
    by: ["camelot"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.camelot] = row._count._all;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Camelot ホイール</h1>
        <p className="mt-1 text-sm text-deck-400">
          キーをクリックすると、そこから繋げられるキーと自分のライブラリの曲数が表示されます。
        </p>
      </div>

      <CamelotWheel counts={counts} />
    </div>
  );
}
