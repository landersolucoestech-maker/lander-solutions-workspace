insert into public.permissions(code,module,action,description) values
('support.read','support','read','Visualizar atendimento conforme escopo.'),
('support.operate','support','operate','Operar conversas e tickets conforme escopo.'),
('support.manage','support','manage','Configurar produtos, filas, formulários, templates, canais e SLA.'),
('support.publish','support','publish','Publicar versões de automações de atendimento.'),
('support.reports.read','support','reports_read','Visualizar indicadores de atendimento.'),
('support.audit.read','support','audit_read','Visualizar histórico e eventos do atendimento.')
on conflict(code) do update set module=excluded.module,action=excluded.action,description=excluded.description;
insert into public.app_roles(code,name,description,is_system) values
('support_admin','Administrador de atendimento','Configuração e operação total do Atendimento e Suporte.',true),
('support_manager','Gestor de atendimento','Gestão de produtos, filas, agentes, SLA e operação.',true),
('support_supervisor','Supervisor de atendimento','Supervisão de filas, atribuições, SLA e operação.',true),
('support_agent','Agente de atendimento','Operação de conversas e tickets autorizados.',true),
('support_viewer','Visualizador de atendimento','Consulta de atendimento e relatórios autorizados.',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.module='support' where r.code in('owner','corporate_admin','support_admin') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code in('support.read','support.operate','support.manage','support.reports.read','support.audit.read') where r.code in('support_manager','unit_manager') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code in('support.read','support.operate','support.reports.read') where r.code='support_supervisor' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code in('support.read','support.operate') where r.code='support_agent' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code in('support.read','support.reports.read') where r.code in('support_viewer','readonly','executive_readonly') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code in('support.read','support.reports.read','support.audit.read') where r.code='auditor' on conflict do nothing;
