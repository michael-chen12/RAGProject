CREATE TABLE public.eval_sets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.eval_cases (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  eval_set_id          uuid NOT NULL REFERENCES public.eval_sets(id) ON DELETE CASCADE,
  question             text NOT NULL,
  expected_answer      text NOT NULL,
  expected_source_ids  jsonb    -- string[] of chunk IDs
);

CREATE TABLE public.eval_runs (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  eval_set_id      uuid NOT NULL REFERENCES public.eval_sets(id) ON DELETE CASCADE,
  recall_at_k      float,
  answer_accuracy  float,
  hallucination_rate float,
  k_value          integer NOT NULL DEFAULT 5,
  details          jsonb,        -- CaseResult[]
  created_at       timestamptz NOT NULL DEFAULT now()
);
