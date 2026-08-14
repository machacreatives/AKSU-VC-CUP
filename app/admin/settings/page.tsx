"use client";

import { PageHeader } from "../ui";
import AccountSection from "../AccountSection";
import PasswordSection from "../PasswordSection";
import VenueSection from "../VenueSection";
import AuditSection from "../AuditSection";
import DatabaseSection from "../DatabaseSection";
import { useMe } from "@/lib/api";

export default function SettingsPage() {
  const { data: me } = useMe();
  const superadmin = me?.role === "SUPERADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader
        title="Settings"
        subtitle={superadmin ? "Administrators, venues, activity and database." : "Your account."}
      />

      <PasswordSection />

      {superadmin && <AccountSection />}

      {superadmin && <VenueSection />}

      {superadmin && <AuditSection />}

      {superadmin && <DatabaseSection />}
    </div>
  );
}
