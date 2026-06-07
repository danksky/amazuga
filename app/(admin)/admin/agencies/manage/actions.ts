"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { uploadAgencyLogo } from "@/lib/server/agency-logo-storage";
import { getPgPool } from "@/lib/server/postgres";

export async function uploadAgencyLogoAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const agencyId = formData.get("agencyId");
  const file = formData.get("file");

  if (typeof agencyId !== "string" || !agencyId) throw new Error("Missing agencyId");
  if (!(file instanceof Blob) || file.size === 0) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("File must be an image");
  if (file.size > 4 * 1024 * 1024) throw new Error("File too large (max 4 MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  const logoUrl = await uploadAgencyLogo(agencyId, buffer, file.type);

  await getPgPool().query(
    `UPDATE agency SET logo_url = $1, updated_at = NOW() WHERE id = $2`,
    [logoUrl, agencyId],
  );

  revalidatePath(routes.admin.agenciesManage);
}
