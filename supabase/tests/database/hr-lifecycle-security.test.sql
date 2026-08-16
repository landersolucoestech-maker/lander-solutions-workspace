begin;

create extension if not exists pgtap with schema extensions;

select plan(16);


select has_function(
  'public','create_hr_onboarding',array['uuid','date','uuid','text'],
  'caller-scoped onboarding creation exists'
);
select has_function(
  'public','create_hr_offboarding',array['uuid','date','text','uuid','text'],
  'caller-scoped offboarding creation exists'
);

select is(
  has_function_privilege(
    'anon','public.create_hr_onboarding(uuid,date,uuid,text)','EXECUTE'
  ),
  false,
  'anonymous users cannot create onboarding'
);
select is(
  has_function_privilege(
    'authenticated','public.create_hr_onboarding(uuid,date,uuid,text)','EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped onboarding creation'
);
select is(
  has_function_privilege(
    'service_role','public.create_hr_onboarding(uuid,date,uuid,text)','EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped onboarding creation'
);

select is(
  has_function_privilege(
    'anon','public.create_hr_offboarding(uuid,date,text,uuid,text)','EXECUTE'
  ),
  false,
  'anonymous users cannot create offboarding'
);
select is(
  has_function_privilege(
    'authenticated','public.create_hr_offboarding(uuid,date,text,uuid,text)','EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped offboarding creation'
);
select is(
  has_function_privilege(
    'service_role','public.create_hr_offboarding(uuid,date,text,uuid,text)','EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped offboarding creation'
);

select is(
  has_function_privilege(
    'anon','public.admin_create_hr_onboarding(uuid,date,uuid,text,uuid)','EXECUTE'
  ),
  false,
  'anonymous users cannot supply an onboarding actor'
);
select is(
  has_function_privilege(
    'authenticated','public.admin_create_hr_onboarding(uuid,date,uuid,text,uuid)','EXECUTE'
  ),
  false,
  'authenticated users cannot supply an onboarding actor'
);
select is(
  has_function_privilege(
    'service_role','public.admin_create_hr_onboarding(uuid,date,uuid,text,uuid)','EXECUTE'
  ),
  false,
  'service role cannot supply an onboarding actor'
);

select is(
  has_function_privilege(
    'anon','public.admin_create_hr_offboarding(uuid,date,text,uuid,text,uuid)','EXECUTE'
  ),
  false,
  'anonymous users cannot supply an offboarding actor'
);
select is(
  has_function_privilege(
    'authenticated','public.admin_create_hr_offboarding(uuid,date,text,uuid,text,uuid)','EXECUTE'
  ),
  false,
  'authenticated users cannot supply an offboarding actor'
);
select is(
  has_function_privilege(
    'service_role','public.admin_create_hr_offboarding(uuid,date,text,uuid,text,uuid)','EXECUTE'
  ),
  false,
  'service role cannot supply an offboarding actor'
);

select extensions.unalike(
  pg_get_functiondef('public.create_hr_onboarding(uuid,date,uuid,text)'::regprocedure),
  '%p_actor_user_id%',
  'public onboarding creation does not accept a supplied actor id'
);
select extensions.unalike(
  pg_get_functiondef('public.create_hr_offboarding(uuid,date,text,uuid,text)'::regprocedure),
  '%p_actor_user_id%',
  'public offboarding creation does not accept a supplied actor id'
);

select * from finish();

rollback;
