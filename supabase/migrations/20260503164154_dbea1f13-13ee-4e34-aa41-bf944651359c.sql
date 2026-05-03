CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  symbol TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_symbol ON public.tasks(symbol);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();