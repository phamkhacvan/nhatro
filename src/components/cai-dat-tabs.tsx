"use client";

import { useState } from "react";
import { House } from "@/lib/types";
import SettingsForm from "@/components/settings-form";
import RoomsManager from "@/components/rooms-manager";
import AccountManager from "@/components/account-manager";
import { UserAccount } from "@/app/actions";

export default function CaiDatTabs({
  house,
  prices,
  rooms,
  contracts,
  me,
  users,
}: {
  house: House;
  prices: { occupancy: number; price: number }[];
  rooms: import("@/lib/types").Room[];
  contracts: Record<string, import("@/lib/types").ContractMeta>;
  me: { id: number; email: string; name: string; is_admin: boolean };
  users: UserAccount[];
}) {
  const [tab, setTab] = useState<"house" | "rooms" | "accounts">("house");

  const tabCls = (active: boolean) =>
    "rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold " +
    (active
      ? "border-blue-900 text-blue-900 dark:border-indigo-400 dark:text-indigo-400"
      : "border-transparent text-slate-500 hover:text-blue-900 dark:text-slate-400 dark:hover:text-indigo-400");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button className={tabCls(tab === "house")} onClick={() => setTab("house")}>
          🏠 Cài đặt phòng
        </button>
        <button className={tabCls(tab === "rooms")} onClick={() => setTab("rooms")}>
          🛏 Phòng & người thuê
        </button>
        <button className={tabCls(tab === "accounts")} onClick={() => setTab("accounts")}>
          👤 Tài khoản
        </button>
      </div>
      {tab === "house" ? (
        <SettingsForm house={house} prices={prices} />
      ) : tab === "rooms" ? (
        <RoomsManager rooms={rooms} contracts={contracts} house={house} />
      ) : (
        <AccountManager me={me} initialUsers={users} />
      )}
    </div>
  );
}