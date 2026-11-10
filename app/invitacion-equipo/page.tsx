import { Suspense } from "react";
import { AcceptStaffInvitation } from "./accept-staff-invitation";

export const dynamic = "force-dynamic";

export default function StaffInvitationPage() {
  return (
    <Suspense>
      <AcceptStaffInvitation />
    </Suspense>
  );
}
