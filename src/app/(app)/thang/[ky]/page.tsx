import { notFound } from "next/navigation";
import { dataForKy } from "@/app/actions";
import { pricesToMap } from "@/lib/calc";
import MonthTable from "@/components/month-table";

export const dynamic = "force-dynamic";

export default async function ThangPage({ params }: { params: Promise<{ ky: string }> }) {
  const { ky } = await params;
  const data = await dataForKy(ky);
  if (!data.house) notFound();

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{data.house.name}</span> · {data.house.address} · Hạn thanh toán {data.house.due_text}
      </p>
      <MonthTable
        key={ky}
        ky={ky}
        isCurrent={ky === data.house.cur_ky}
        house={data.house}
        prices={pricesToMap(data.prices)}
        rows={data.rows}
        prevRows={data.prevRows}
        minKy={data.minKy}
      />
    </div>
  );
}