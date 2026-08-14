import { ConfirmProvider } from "@/components/ConfirmDialog";
import AdminNav from "./AdminNav";

// One dialog instance and one nav for the whole admin area, so pages under
// /admin only render their own content.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <AdminNav />
      {children}
    </ConfirmProvider>
  );
}
