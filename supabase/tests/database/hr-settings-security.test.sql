begin;

create extension if not exists pgtap with schema extensions;

select plan(7);


select has_function(
  'public',
  'upsert_hr_settings',
  array['uuid','integer','integer','bigint'],
  'caller-scoped HR settings mutation exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.upsert_hr_settings(uuid,integer,integer,bigint)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot mutate HR settings'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_hr_settings(uuid,integer,integer,bigint)',
    'EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped HR settings mutation'
);

select is(
  has_function_privilege(
    'service_role',
    'public.upsert_hr_settings(uuid,integer,integer,bigint)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped HR settings mutation'
);

select extensions.unalike(
  pg_get_functiondef(
    'public.upsert_hr_settings(uuid,integer,integer,bigint)'::regprocedure
  ),
  '%p_actor_user_id%',
  'HR settings mutation does not accept a supplied actor id'
);

select extensions.alike(
  pg_get_functiondef(
    'public.upsert_hr_settings(uuid,integer,integer,bigint)'::regprocedure
  ),
  '%auth.uid()%',
  'HR settings mutation derives the actor from the session'
);

select extensions.alike(
  pg_get_functiondef(
    'public.upsert_hr_settings(uuid,integer,integer,bigint)'::regprocedure
  ),
  '%has_aal2()%',
  'HR settings mutation requires MFA aal2'
);

select * from finish();

rollback;
