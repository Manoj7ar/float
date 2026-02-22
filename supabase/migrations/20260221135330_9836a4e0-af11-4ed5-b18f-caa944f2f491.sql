
-- Accounts table
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL DEFAULT 'My Business',
  sector text DEFAULT 'restaurant',
  employee_count integer DEFAULT 0,
  payroll_amount integer DEFAULT 0,
  payroll_frequency text DEFAULT 'biweekly',
  payroll_day text DEFAULT 'friday',
  monzo_access_token text,
  monzo_account_id text,
  monzo_connected boolean DEFAULT false,
  onboarding_complete boolean DEFAULT false,
  risk_level text DEFAULT 'healthy',
  payroll_at_risk boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own account" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own account" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);

-- Transactions table
CREATE TABLE public.transactions (
  id text PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  merchant_name text,
  category text,
  description text,
  is_income boolean DEFAULT false,
  created timestamptz NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  client_phone text,
  client_email text,
  invoice_number text,
  amount integer NOT NULL,
  invoice_date date,
  due_date date,
  status text DEFAULT 'unpaid',
  stripe_payment_link text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own invoices" ON public.invoices FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own invoices" ON public.invoices FOR DELETE
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- AI Insights table
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_label text,
  action_type text,
  dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights" ON public.ai_insights FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own insights" ON public.ai_insights FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own insights" ON public.ai_insights FOR UPDATE
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Incidents table
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  severity text NOT NULL DEFAULT 'P2',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  shortfall_amount integer,
  events jsonb DEFAULT '[]'::jsonb,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own incidents" ON public.incidents FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own incidents" ON public.incidents FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own incidents" ON public.incidents FOR UPDATE
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Cashflow Projections table
CREATE TABLE public.cashflow_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  projection_date date NOT NULL,
  projected_balance integer NOT NULL,
  is_below_payroll_threshold boolean DEFAULT false,
  is_below_zero boolean DEFAULT false,
  UNIQUE(account_id, projection_date)
);

ALTER TABLE public.cashflow_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projections" ON public.cashflow_projections FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own projections" ON public.cashflow_projections FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own projections" ON public.cashflow_projections FOR UPDATE
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Chat Messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Calls table
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id),
  client_name text NOT NULL,
  client_phone text NOT NULL,
  status text DEFAULT 'initiated',
  duration_seconds integer,
  outcome text,
  transcript text,
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calls" ON public.calls FOR SELECT
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own calls" ON public.calls FOR INSERT
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own calls" ON public.calls FOR UPDATE
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cashflow_projections;
