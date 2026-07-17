-- 010_card_style.sql — Card Style (delivery dials), starting with the Confrontationalness Dial.
--
-- 2026-07-16. Per-user DELIVERY preferences — how the live cards SOUND — kept SEPARATE from
-- profiles.sales_dna (which is offer/discovery CONTENT). Its own jsonb blob so adding the
-- formality dial later needs no migration. Full context: tasks/todo.md, Wingman Design Language.
--
-- SAFETY: this migration is ADDITIVE and non-destructive. It adds one column (defaulting to an
-- empty blob) and one function. It deletes nothing and alters no existing column. An absent/empty
-- card_style resolves to the "direct" default in code, which reproduces today's cards byte-for-byte.
--
-- NOTE (Known Issue #50): profiles.sales_dna + set_sales_dna_syntax_if_unsure were applied to
-- Supabase by hand and never captured in a migration. We are NOT repeating that here — this dial's
-- column and function ship as this file. Run it in the Supabase SQL Editor (Dashboard → SQL).

-- 1) The column. NOT NULL DEFAULT '{}' → every existing row gets an empty blob immediately.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS card_style jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Atomic single-KEY writer. SECURITY DEFINER so it runs with the table owner's rights: the app
--    calls it via the service-role client *after* verifying the authenticated user (mirrors the
--    existing /api/profile/update pattern; profiles has no owner-scoped UPDATE policy for the
--    anon/authenticated role today). Writing ONE key at a time via jsonb_set means a future
--    formality write and a confrontation write — or a dashboard save and a mid-call toggle — can
--    never clobber each other. Both key and value are whitelisted, so a buggy/hostile caller can
--    only ever set a KNOWN dial to a KNOWN level; anything else raises and writes nothing.
CREATE OR REPLACE FUNCTION public.set_card_style_key(
  p_user_id uuid,
  p_key     text,
  p_value   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Known dials. `formality` is reserved for the follow-on dial (no writer yet).
  IF p_key NOT IN ('confrontation', 'formality') THEN
    RAISE EXCEPTION 'set_card_style_key: unknown key %', p_key;
  END IF;
  -- The four confrontationalness levels. (Formality's own level set is added when that dial ships.)
  IF p_value NOT IN ('consultative', 'balanced', 'direct', 'challenger') THEN
    RAISE EXCEPTION 'set_card_style_key: unknown value %', p_value;
  END IF;

  UPDATE public.profiles
     SET card_style = jsonb_set(COALESCE(card_style, '{}'::jsonb), ARRAY[p_key], to_jsonb(p_value), true),
         updated_at = now()
   WHERE id = p_user_id;
END;
$$;

-- Only the service role (used by the authenticated API route) should call this. Lock out the
-- anon/authenticated roles so it can never be invoked directly from a client with a forged user id,
-- then GRANT execute to service_role EXPLICITLY (belt-and-suspenders — don't rely on the default
-- privileges surviving the REVOKE; without this the Phase 1b save route could silently 500).
REVOKE ALL ON FUNCTION public.set_card_style_key(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_card_style_key(uuid, text, text) TO service_role;
