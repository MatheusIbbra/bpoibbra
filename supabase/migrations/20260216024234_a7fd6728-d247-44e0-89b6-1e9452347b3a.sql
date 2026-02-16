-- Função para detectar anomalias em transações
CREATE OR REPLACE FUNCTION public.detect_transaction_anomalies(p_organization_id uuid, p_lookback_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_anomalies jsonb := '[]'::jsonb;
BEGIN
  -- Detectar transações com valor muito acima da média histórica por categoria
  WITH category_stats AS (
    SELECT
      t.category_id,
      c.name as category_name,
      t.type,
      AVG(t.amount) as avg_amount,
      STDDEV(t.amount) as stddev_amount,
      COUNT(*) as total_count
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.organization_id = p_organization_id
      AND t.date >= (current_date - (p_lookback_days || ' days')::interval)::date
      AND t.is_ignored IS NOT TRUE
      AND t.category_id IS NOT NULL
    GROUP BY t.category_id, c.name, t.type
    HAVING COUNT(*) >= 3
  ),
  recent_outliers AS (
    SELECT
      t.id as transaction_id,
      t.description,
      t.amount,
      t.date,
      t.type,
      cs.category_name,
      cs.avg_amount,
      cs.stddev_amount,
      CASE 
        WHEN cs.stddev_amount > 0 
        THEN (t.amount - cs.avg_amount) / cs.stddev_amount 
        ELSE 0 
      END as z_score
    FROM transactions t
    JOIN category_stats cs ON cs.category_id = t.category_id AND cs.type = t.type
    WHERE t.organization_id = p_organization_id
      AND t.date >= (current_date - interval '30 days')::date
      AND t.is_ignored IS NOT TRUE
      AND cs.stddev_amount > 0
      AND (t.amount - cs.avg_amount) / cs.stddev_amount > 2.0
    ORDER BY (t.amount - cs.avg_amount) / cs.stddev_amount DESC
    LIMIT 10
  ),
  -- Detectar picos de despesa diária
  daily_spikes AS (
    SELECT
      t.date,
      SUM(t.amount) as daily_total,
      'expense' as type
    FROM transactions t
    WHERE t.organization_id = p_organization_id
      AND t.type = 'expense'
      AND t.date >= (current_date - interval '30 days')::date
      AND t.is_ignored IS NOT TRUE
    GROUP BY t.date
  ),
  daily_stats AS (
    SELECT
      AVG(daily_total) as avg_daily,
      STDDEV(daily_total) as stddev_daily
    FROM (
      SELECT date, SUM(amount) as daily_total
      FROM transactions
      WHERE organization_id = p_organization_id
        AND type = 'expense'
        AND date >= (current_date - (p_lookback_days || ' days')::interval)::date
        AND is_ignored IS NOT TRUE
      GROUP BY date
    ) hist
  ),
  spike_days AS (
    SELECT
      ds.date,
      ds.daily_total,
      dst.avg_daily,
      CASE WHEN dst.stddev_daily > 0 
        THEN (ds.daily_total - dst.avg_daily) / dst.stddev_daily 
        ELSE 0 
      END as z_score
    FROM daily_spikes ds, daily_stats dst
    WHERE dst.stddev_daily > 0
      AND (ds.daily_total - dst.avg_daily) / dst.stddev_daily > 2.0
    ORDER BY ds.daily_total DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'transaction_outliers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'transaction_id', transaction_id,
        'description', description,
        'amount', ROUND(amount, 2),
        'date', date,
        'type', type,
        'category', category_name,
        'avg_amount', ROUND(avg_amount, 2),
        'z_score', ROUND(z_score::numeric, 2),
        'severity', CASE 
          WHEN z_score > 3 THEN 'critical'
          WHEN z_score > 2.5 THEN 'high'
          ELSE 'moderate'
        END
      )) FROM recent_outliers
    ), '[]'::jsonb),
    'daily_spikes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', date,
        'total', ROUND(daily_total, 2),
        'avg_daily', ROUND(avg_daily, 2),
        'z_score', ROUND(z_score::numeric, 2),
        'severity', CASE 
          WHEN z_score > 3 THEN 'critical'
          WHEN z_score > 2.5 THEN 'high'
          ELSE 'moderate'
        END
      )) FROM spike_days
    ), '[]'::jsonb),
    'generated_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;