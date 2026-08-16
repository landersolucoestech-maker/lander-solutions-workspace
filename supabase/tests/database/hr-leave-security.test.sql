begin;

create extension if not exists pgtap with schema extensions;

select plan(8);


select has_function(
  'public','decide_hr_leave',array['uuid','text','text','bigint'],
  'caller-scoped leave decision exists'
);
select is(
  has_function_privilege(
    'anon','public.decide_hr_leave(uuid,text,text,bigint)','EXECUTE'
  ),
  false,
  'anonymous users cannot decide leave requests'
);
select is(
  has_function_privilege(
    'authenticated','public.decide_hr_leave(uuid,text,text,bigint)','EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped leave decisions'
);
select is(
  has_function_privilege(
    'service_role','public.decide_hr_leave(uuid,text,text,bigint)','EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped leave decisions'
);

select is(
  has_function_privilege(
    'anon','public.admin_decide_hr_leave(uuid,text,text,bigint,uuid)','EXECUTE'
  ),
  false,
  'anonymous users cannot supply a leave decision actor'
);
select is(
  has_function_privilege(
    'authenticated','public.admin_decide_hr_leave(uuid,text,text,bigint,uuid)','EXECUTE'
  ),
  false,
  'authenticated users cannot supply a leave decision actor'
);
select is(
  has_function_privilege(
    'service_role','public.admin_decide_hr_leave(uuid,text,text,bigint,uuid)','EXECUTE'
  ),
  false,
  'service role cannot supply a leave decision actor'
);
select extensions.unalike(
  pg_get_functiondef('public.decide_hr_leave(uuid,text,text,bigint)'::regprocedure),
  '%p_actor_user_id%',
  'public leave decision does not accept a supplied actor id'
);

select * from finish();

rollback;
