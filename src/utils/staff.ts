import type { OperatorStaffProfile } from "../types/operator";

export function isManager(staff: OperatorStaffProfile | null | undefined): boolean {
  return staff?.staff_role === "owner" || staff?.staff_role === "manager";
}

/** Which operator screens a staff member may open. The API enforces the
 * same rules (IsOperatorOwnerOrManager / IsOperatorManagerOrCounterAgent);
 * this only keeps people from landing on pages that would 403. */
export function canOpen(staff: OperatorStaffProfile, area: "manage" | "sell"): boolean {
  return area === "manage" ? isManager(staff) : isManager(staff) || staff.can_create_bookings;
}
