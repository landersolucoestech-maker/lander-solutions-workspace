begin;

create extension if not exists pgtap with schema extensions;

select plan(8);


select has_function(
  'public','mark_hr_payment_paid',array['uuid','date','text','text','bigint'],
  'caller-scoped employee payment posting exists'
);
select is(
  has_function_privilege(
    'anon','public.mark_hr_payment_paid(uuid,date,text,text,bigint)','EXECUTE'
  ),
  false,
  'anonymous users cannot post employee payments'
);
select is(
  has_function_privilege(
    'authenticated','public.mark_hr_payment_paid(uuid,date,text,text,bigint)','EXECUTE'
  ),
  true,
  'authenticated users can reach caller-scoped employee payment posting'
);
select is(
  has_function_privilege(
    'service_role','public.mark_hr_payment_paid(uuid,date,text,text,bigint)','EXECUTE'
  ),
  false,
  'service role cannot bypass caller-scoped employee payment posting'
);

select is(
  has_function_privilege(
    'anon','public.admin_mark_hr_payment_paid(uuid,date,text,text,bigint,uuid)','EXECUTE'
  ),
  false,
  'anonymous users cannot supply a payment actor'
);
select is(
  has_function_privilege(
    'authenticated','public.admin_mark_hr_payment_paid(uuid,date,text,text,bigint,uuid)','EXECUTE'
  ),
  false,
  'authenticated users cannot supply a payment actor'
);
select is(
  has_function_privilege(
    'service_role','public.admin_mark_hr_payment_paid(uuid,date,text,text,bigint,uuid)','EXECUTE'
  ),
  false,
  'service role cannot supply a payment actor'
);
select extensions.unalike(
  pg_get_functiondef('public.mark_hr_payment_paid(uuid,date,text,text,bigint)'::regprocedure),
  '%p_actor_user_id%',
  'public employee payment posting does not accept a supplied actor id'
);

select * from finish();

rollback;
