-- Add expense_classification column to categories table
-- This field is only used for expense-type categories
ALTER TABLE public.categories 
ADD COLUMN expense_classification text;

-- Add a check constraint to ensure valid values
ALTER TABLE public.categories 
ADD CONSTRAINT categories_expense_classification_check 
CHECK (
  expense_classification IS NULL 
  OR expense_classification IN ('fixa', 'variavel_programada', 'variavel_recorrente')
);

-- Add comment explaining the field
COMMENT ON COLUMN public.categories.expense_classification IS 'Classification for expense categories: fixa (Fixed), variavel_programada (Programmed Variable), variavel_recorrente (Recurring Variable)';

-- Create an index for filtering by classification
CREATE INDEX idx_categories_expense_classification ON public.categories(expense_classification) WHERE expense_classification IS NOT NULL;