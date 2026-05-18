"use client";

import { useTransition } from "react";
import { setUserRole } from "@/app/admin/members/actions";

const ROLES = [
  { value: "member",    label: "Member" },
  { value: "leader",    label: "Leader" },
  { value: "organiser", label: "Organiser" },
  { value: "admin",     label: "Admin" },
] as const;

export function RoleSelect({
  userId,
  userName,
  currentRole,
}: {
  userId: string;
  userName: string;
  currentRole: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (newRole === currentRole) return;
    if (
      newRole === "admin" &&
      !window.confirm(`Make ${userName} an admin? They will have full access to all admin features.`)
    ) {
      e.target.value = currentRole; // reset
      return;
    }
    startTransition(async () => {
      await setUserRole(userId, newRole);
    });
  };

  return (
    <select
      defaultValue={currentRole}
      disabled={pending}
      onChange={handleChange}
      className="rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-2 py-1.5 text-xs font-medium outline-none disabled:opacity-50 cursor-pointer"
      title="Change role"
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
