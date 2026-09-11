alter function public.merge_achievement_arrays_v2(
    smallint[], bigint[], smallint, bigint, text
) set search_path = public, pg_temp;
