export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import TambahPanenClient from "./TambahPanenClient";

export default async function HalamanTambahPanen() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "PETANI") {
    redirect("/");
  }

  return <TambahPanenClient />;
}
