-- Read only, opaque Wallet provenance for the shared teaching-hours reader.
-- The underlying entitlement/member table retains its existing service-only ACL.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);
CREATE VIEW public.coach_wallet_member_redemptions_v1 WITH (security_barrier=true) AS
 SELECT m.credit_id,m.original_session_id,m.redeemed_session_id
 FROM public.lesson_wallet_credit_members m
 JOIN public.booking_sessions s ON s.id=m.redeemed_session_id
 WHERE auth.role()='service_role' OR EXISTS(
  SELECT 1 FROM public.profiles actor WHERE actor.id=auth.uid() AND (
   actor.role::text IN ('admin','super_admin')
   OR (actor.role::text='head_coach' AND EXISTS(SELECT 1 FROM public.coach_branches cb WHERE cb.coach_id=actor.id AND cb.branch_id=s.branch_id))
   OR (actor.role::text='coach' AND (
    EXISTS(SELECT 1 FROM public.coach_assignment_groups g JOIN public.coach_assignment_group_students gm ON gm.group_id=g.id
     WHERE g.schedule_slot_id=s.schedule_slot_id AND g.coach_id=actor.id AND gm.booking_session_id=s.id)
    OR (NOT EXISTS(SELECT 1 FROM public.coach_assignment_groups g WHERE g.schedule_slot_id=s.schedule_slot_id)
     AND EXISTS(SELECT 1 FROM public.coach_assignments ca WHERE ca.schedule_slot_id=s.schedule_slot_id AND ca.coach_id=actor.id))
   ))
  ));
COMMENT ON VIEW public.coach_wallet_member_redemptions_v1 IS 'Opaque redeemed member IDs only; JWT role and current assignment/branch restrict authenticated staff. Never exposes wallet balances, expiry, money or learner names.';
REVOKE ALL ON public.coach_wallet_member_redemptions_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.coach_wallet_member_redemptions_v1 TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
