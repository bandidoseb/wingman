-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with Wingman-specific profile data
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  role TEXT CHECK (role IN ('closer', 'setter')),
  sales_style TEXT,
  call_length TEXT,
  activation_key TEXT,
  onboarding_step TEXT DEFAULT 'welcome',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  -- Stripe
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  subscription_plan TEXT,
  -- Alerts preferences (JSONB for flexibility)
  alert_pitching_early BOOLEAN DEFAULT TRUE,
  alert_missed_topics BOOLEAN DEFAULT TRUE,
  alert_post_call_debrief BOOLEAN DEFAULT TRUE,
  alert_weekly_summary BOOLEAN DEFAULT FALSE,
  assist_enabled BOOLEAN DEFAULT FALSE,
  signal_display_mode TEXT DEFAULT 'short' CHECK (signal_display_mode IN ('header', 'short', 'full')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── OFFERS ───────────────────────────────────────────────────────────────────
CREATE TABLE public.offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price TEXT,
  is_main BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── QUALIFICATION CRITERIA ───────────────────────────────────────────────────
CREATE TABLE public.qualification_criteria (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('green_flag', 'dq_signal')),
  text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USER ONBOARDING OBJECTIONS & EXIT LINE ───────────────────────────────────
CREATE TABLE public.user_onboarding_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  objections JSONB DEFAULT '[]',   -- array of objection strings from onboarding
  exit_line TEXT,
  offer_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── VAULT OBJECTIONS ─────────────────────────────────────────────────────────
CREATE TABLE public.vault_objections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  objection TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  handle1 TEXT,
  handle2 TEXT,
  is_new BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── VAULT SIGNALS ────────────────────────────────────────────────────────────
CREATE TABLE public.vault_signals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stage TEXT NOT NULL,
  stage_color TEXT,
  header TEXT NOT NULL,
  trigger TEXT,
  text TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  is_new BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CALLS ────────────────────────────────────────────────────────────────────
CREATE TABLE public.calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prospect_name TEXT,
  outcome TEXT CHECK (outcome IN ('Closed', 'Lost', 'DQ', 'Follow Up', 'Set')),
  duration TEXT,
  summary TEXT,
  missed_topics TEXT[] DEFAULT '{}',
  call_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CALL STAGES ──────────────────────────────────────────────────────────────
CREATE TABLE public.call_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete', 'partial', 'skipped', 'early', 'lost')),
  note TEXT,
  display_order INTEGER DEFAULT 0
);

-- ─── CALL TRANSCRIPT ──────────────────────────────────────────────────────────
CREATE TABLE public.call_transcript (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  sequence_order INTEGER NOT NULL
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcript ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Offers
CREATE POLICY "Users can manage own offers" ON public.offers FOR ALL USING (auth.uid() = user_id);

-- Qualification criteria
CREATE POLICY "Users can manage own criteria" ON public.qualification_criteria FOR ALL USING (auth.uid() = user_id);

-- Onboarding data
CREATE POLICY "Users can manage own onboarding data" ON public.user_onboarding_data FOR ALL USING (auth.uid() = user_id);

-- Vault objections
CREATE POLICY "Users can manage own vault objections" ON public.vault_objections FOR ALL USING (auth.uid() = user_id);

-- Vault signals
CREATE POLICY "Users can manage own vault signals" ON public.vault_signals FOR ALL USING (auth.uid() = user_id);

-- Calls
CREATE POLICY "Users can manage own calls" ON public.calls FOR ALL USING (auth.uid() = user_id);

-- Call stages
CREATE POLICY "Users can view stages for own calls" ON public.call_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.calls WHERE calls.id = call_stages.call_id AND calls.user_id = auth.uid()));

-- Call transcript
CREATE POLICY "Users can view transcripts for own calls" ON public.call_transcript FOR ALL
  USING (EXISTS (SELECT 1 FROM public.calls WHERE calls.id = call_transcript.call_id AND calls.user_id = auth.uid()));

-- ─── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_vault_objections_updated_at BEFORE UPDATE ON public.vault_objections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_vault_signals_updated_at BEFORE UPDATE ON public.vault_signals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_onboarding_updated_at BEFORE UPDATE ON public.user_onboarding_data
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_offers_user_id ON public.offers(user_id);
CREATE INDEX idx_qualification_criteria_user_id ON public.qualification_criteria(user_id);
CREATE INDEX idx_vault_objections_user_id ON public.vault_objections(user_id);
CREATE INDEX idx_vault_signals_user_id ON public.vault_signals(user_id);
CREATE INDEX idx_calls_user_id ON public.calls(user_id);
CREATE INDEX idx_calls_call_date ON public.calls(call_date DESC);
CREATE INDEX idx_call_stages_call_id ON public.call_stages(call_id);
CREATE INDEX idx_call_transcript_call_id ON public.call_transcript(call_id);
