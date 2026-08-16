-- Legacy equipment and legal-case ledgers were migrated to the canonical
-- corporate_assets, asset_assignments and legal_matters domains.

DO $$
DECLARE
  v_missing integer;
  v_dependencies integer;
BEGIN
  IF to_regclass('public.equipment') IS NOT NULL THEN
    SELECT count(*) INTO v_missing
    FROM public.equipment legacy
    LEFT JOIN public.corporate_assets canonical ON canonical.id=legacy.id
    WHERE canonical.id IS NULL;
    IF v_missing<>0 THEN
      RAISE EXCEPTION 'Existem % equipamentos sem ativo canônico.',v_missing;
    END IF;
  END IF;

  IF to_regclass('public.equipment_assignments') IS NOT NULL THEN
    SELECT count(*) INTO v_missing
    FROM public.equipment_assignments legacy
    LEFT JOIN public.asset_assignments canonical ON canonical.id=legacy.id
    WHERE canonical.id IS NULL;
    IF v_missing<>0 THEN
      RAISE EXCEPTION 'Existem % atribuições sem histórico canônico.',v_missing;
    END IF;
  END IF;

  IF to_regclass('public.legal_cases') IS NOT NULL THEN
    SELECT count(*) INTO v_missing
    FROM public.legal_cases legacy
    LEFT JOIN public.legal_matters canonical ON canonical.id=legacy.id
    WHERE canonical.id IS NULL;
    IF v_missing<>0 THEN
      RAISE EXCEPTION 'Existem % casos jurídicos sem assunto canônico.',v_missing;
    END IF;
  END IF;

  SELECT count(*) INTO v_dependencies
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype='f'
    AND constraint_row.confrelid IN (
      coalesce(to_regclass('public.equipment'),0),
      coalesce(to_regclass('public.equipment_assignments'),0),
      coalesce(to_regclass('public.legal_cases'),0)
    )
    AND constraint_row.conrelid NOT IN (
      coalesce(to_regclass('public.equipment'),0),
      coalesce(to_regclass('public.equipment_assignments'),0),
      coalesce(to_regclass('public.legal_cases'),0)
    );
  IF v_dependencies<>0 THEN
    RAISE EXCEPTION 'Existem % chaves estrangeiras externas para tabelas legadas.',v_dependencies;
  END IF;
END;
$$;

-- Remove only the known policies owned by the legacy ledgers. In particular,
-- equipment_select_hr reads equipment_assignments and would otherwise prevent
-- the assignment ledger from being dropped with RESTRICT.
DROP POLICY IF EXISTS equipment_select_hr ON public.equipment;
DROP POLICY IF EXISTS equipment_assignments_select_hr ON public.equipment_assignments;
DROP POLICY IF EXISTS legal_cases_select ON public.legal_cases;

DROP TABLE IF EXISTS public.equipment_assignments RESTRICT;
DROP TABLE IF EXISTS public.equipment RESTRICT;
DROP TABLE IF EXISTS public.legal_cases RESTRICT;
