begin;

create extension if not exists pgtap with schema extensions;

select plan(8);


select has_function(
  'public','complete_hr_offboarding',array['uuid','date','bigint'],
  'caller-scoped offboarding completion exists'
);
select is(
  has_function_privilege(
    'anon','public.complete_hr_offboarding(uuid,date,bigint)','EXECUTE'
  ),
  false,
  'anonymous users cannot complete offboarding'
);
select is(
  has_function_privilege(
    'authenticated','public.complete_hr_offboarding(uuid,date,bigint)','EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped offboarding completion'
);
select is(
  has_function_privilege(
    'service_role','public.complete_hr_offboarding(uuid,date,bigint)','EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped offboarding completion'
);

select is(
  has_function_privilege(
    'anon','public.admin_complete_hr_offboarding(uuid,date,bigint,uuid)','EXECUTE'
  ),
  false,
  'anonymous users cannot supply an offboarding actor'
);
select is(
  has_function_privilege(
    'authenticated','public.admin_complete_hr_offboarding(uuid,date,bigint,uuid)','EXECUTE'
  ),
  false,
  'authenticated users cannot supply an offboarding actor'
);
select is(
  has_function_privilege(
    'service_role','public.admin_complete_hr_offboarding(uuid,date,bigint,uuid)','EXECUTE'
  ),
  false,
  'service role cannot supply an offboarding actor'
);
select extensions.unalike(
  pg_get_functiondef('public.complete_hr_offboarding(uuid,date,bigint)'::regprocedure),
  '%p_actor_user_id%',
  'public offboarding completion does not accept a supplied actor id'
);

select * from finish();

rollback;
