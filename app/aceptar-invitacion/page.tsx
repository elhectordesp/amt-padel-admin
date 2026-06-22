import { Suspense } from "react";
import { AcceptInvitationForm } from "./accept-form";

export const dynamic = "force-dynamic";

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationForm />
    </Suspense>
  );
}
