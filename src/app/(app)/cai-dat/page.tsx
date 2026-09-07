import { settingsData } from "@/app/actions";
import CaiDatTabs from "@/components/cai-dat-tabs";

export const dynamic = "force-dynamic";

export default async function CaiDatPage() {
  const data = await settingsData();
  const { house, prices, rooms, me, users } = data;

  if (!house) return <p className="text-sm text-slate-500">Chưa có nhà trọ nào.</p>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-blue-900">Cài đặt · {house.name}</h1>
      <CaiDatTabs
        house={house}
        prices={prices}
        rooms={rooms}
        me={me ?? { id: 0, email: "", name: "", is_admin: false }}
        users={users}
      />
    </div>
  );
}