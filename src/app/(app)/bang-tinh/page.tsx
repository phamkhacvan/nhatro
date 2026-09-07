import { redirect } from "next/navigation";
import { bangTinhKy } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function BangTinhPage() {
  const ky = await bangTinhKy();
  redirect(`/thang/${ky}`);
}