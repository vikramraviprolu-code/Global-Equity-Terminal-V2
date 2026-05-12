-- Add task_id column to alerts table for task-alert integration
-- This allows linking alerts to research tasks for better workflow management

-- Add task_id column to alerts table
ALTER TABLE alerts
ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Add index for better query performance on task_id
CREATE INDEX idx_alerts_task_id ON alerts(task_id);

-- Add comment to document the relationship
COMMENT ON COLUMN alerts.task_id IS 'Optional link to a research task. Allows connecting alerts to specific research follow-ups.';

-- Add disable_alerts_on_complete column to tasks table
ALTER TABLE tasks
ADD COLUMN disable_alerts_on_complete BOOLEAN DEFAULT FALSE;

-- Add comment to document the feature
COMMENT ON COLUMN tasks.disable_alerts_on_complete IS 'When true, automatically disables all linked alerts when task is marked as done.';