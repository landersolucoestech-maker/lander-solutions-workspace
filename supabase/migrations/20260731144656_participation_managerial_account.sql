insert into public.managerial_accounts(code,name,account_type,normal_balance,posting_allowed,status,is_system)
values('6200','Participações e repasses econômicos','expense','debit',true,'active',true)
on conflict(code) do nothing;