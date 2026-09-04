-- The actual root cause of the campaign-creation 403 (confirmed by direct
-- diagnostics): INSERT ... RETURNING (what .select('id').single() compiles
-- to) has to satisfy the table's SELECT policy for the row it hands back,
-- checked as part of the insert — *before* the on_campaign_created AFTER
-- INSERT trigger has added the creator to campaign_members. The INSERT's
-- own WITH CHECK ("creator becomes gm") passes fine; it's the read-back
-- that fails, reported as the same "violates row-level security policy"
-- error, which is what made this so misleading to diagnose from outside.
--
-- Fix: a campaign's creator can obviously always see their own campaign,
-- membership-table timing aside — so the SELECT policy should say that
-- directly instead of only trusting campaign_members.
drop policy if exists "members can read their campaigns" on campaigns;

create policy "members can read their campaigns" on campaigns
  for select using (is_campaign_member(id) or auth.uid() = gm_id);
