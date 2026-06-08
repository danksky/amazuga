import Link from "next/link";

import { AdminNav } from "@/features/admin/admin-nav";
import { requireAdminUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { listAgenciesFromDb } from "@/lib/server/workflows";

import { uploadAgencyLogoAction } from "./actions";
import styles from "./manage.module.css";
import adminStyles from "@/features/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function AgenciesManagePage() {
  await requireAdminUser();
  const allAgencies = await listAgenciesFromDb();
  const agencies = allAgencies.filter((a) => a.status === "approved");

  return (
    <div className={`container ${adminStyles.page}`}>
      <div className={adminStyles.stack}>
        <div className={adminStyles.header}>
          <div className={adminStyles.eyebrow}>Admin</div>
          <AdminNav active="agencies" />
          <h1 className={adminStyles.title}>Manage agencies</h1>
          <div className={adminStyles.body}>Upload logos for approved agencies.</div>
        </div>

        <nav aria-label="Agency administration" className={adminStyles.nav}>
          <Link className={adminStyles.navLink} href={routes.admin.agencies}>Review queue</Link>
          <Link className={`${adminStyles.navLink} ${adminStyles.active}`} href={routes.admin.agenciesManage}>
            Manage logos
          </Link>
        </nav>

        <div className={adminStyles.panel}>
          {agencies.length === 0 ? (
            <p className={adminStyles.empty}>No approved agencies.</p>
          ) : (
            <div className={styles.list}>
              {agencies.map((agency) => (
                <div className={styles.row} key={agency.id}>
                  <div className={styles.logo}>
                    {agency.logoUrl ? (
                      <img alt={agency.businessName} className={styles.logoImg} src={agency.logoUrl} />
                    ) : (
                      <div className={styles.logoPlaceholder}>No logo</div>
                    )}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>{agency.businessName}</div>
                    <div className={styles.slug}>{agency.slug}</div>
                  </div>
                  <form action={uploadAgencyLogoAction} className={styles.uploadForm}>
                    <input name="agencyId" type="hidden" value={agency.id} />
                    <input accept="image/*" className={styles.fileInput} name="file" type="file" />
                    <button className={adminStyles.primaryAction} type="submit">
                      {agency.logoUrl ? "Replace" : "Upload"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
