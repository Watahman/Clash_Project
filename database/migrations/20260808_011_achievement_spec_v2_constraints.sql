-- ClashPanel Advanced Achievements spec v2 supports six rarities and up to seven fixed tiers.
-- Existing progress rows remain valid; this only widens the existing checks.

alter table public.achievement_progress
    drop constraint if exists achievement_progress_rarity_check;

alter table public.achievement_progress
    add constraint achievement_progress_rarity_check
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'));

alter table public.achievement_progress
    drop constraint if exists achievement_progress_tier_check;

alter table public.achievement_progress
    add constraint achievement_progress_tier_check
    check (tier between 1 and 7);
