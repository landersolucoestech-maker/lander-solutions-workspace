alter table public.contract_templates
  add column if not exists variables_manifest jsonb not null default '[]'::jsonb,
  add column if not exists party_roles text[] not null default '{}'::text[],
  add column if not exists signature_roles text[] not null default '{}'::text[],
  add column if not exists header_text text not null default '',
  add column if not exists footer_text text not null default '';

alter table public.contract_versions
  add column if not exists party_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists template_variables jsonb not null default '{}'::jsonb,
  add column if not exists signers_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists rendered_body text not null default '',
  add column if not exists unresolved_placeholders text[] not null default '{}'::text[];

update public.contract_templates
set
  body_text = $template$
CONTRATO DE LICENÇA DE USO DE SOFTWARE COMO SERVIÇO

Pelo presente instrumento, de um lado, {{CONTRATANTE.RAZAO_SOCIAL}}, inscrita no CPF/CNPJ sob nº {{CONTRATANTE.CPF_CNPJ}}, com endereço em {{CONTRATANTE.ENDERECO_COMPLETO}}, e, de outro, {{CONTRATADA.RAZAO_SOCIAL}}, inscrita no CNPJ sob nº {{CONTRATADA.CPF_CNPJ}}, com sede em {{CONTRATADA.ENDERECO_COMPLETO}}, celebram o presente contrato.

1. OBJETO
1.1. A CONTRATADA licencia à CONTRATANTE o acesso ao produto {{CONTRATO.PRODUTO_SERVICO}}, conforme o plano {{CONTRATO.PLANO}}, para utilização durante a vigência contratual.

2. VIGÊNCIA
2.1. O contrato inicia-se em {{CONTRATO.DATA_INICIO}} e encerra-se em {{CONTRATO.DATA_FIM}}, observada a regra de renovação {{CONTRATO.RENOVACAO}}.

3. PREÇO E PAGAMENTO
3.1. A CONTRATANTE pagará o valor de {{CONTRATO.VALOR}}, com frequência {{CONTRATO.FATURAMENTO}} e vencimento em {{CONTRATO.PRAZO_PAGAMENTO_DIAS}} dias.

4. PROTEÇÃO DE DADOS
4.1. As partes observarão a legislação aplicável e utilizarão os dados pessoais exclusivamente para execução deste instrumento.

5. DISPOSIÇÕES GERAIS
5.1. As condições específicas são: {{CONTRATO.OBSERVACOES}}.

{{SIGNATURE.CONTRATANTE}}
{{SIGN_DATE.CONTRATANTE}}

{{SIGNATURE.CONTRATADA}}
{{SIGN_DATE.CONTRATADA}}
$template$,
  variables_manifest = jsonb_build_array(
    jsonb_build_object('key','CONTRATO.PRODUTO_SERVICO','label','Produto ou serviço','type','text','required',true,'group','Contrato'),
    jsonb_build_object('key','CONTRATO.PLANO','label','Plano contratado','type','text','required',true,'group','Contrato'),
    jsonb_build_object('key','CONTRATO.DATA_INICIO','label','Data de início','type','date','required',true,'group','Vigência'),
    jsonb_build_object('key','CONTRATO.DATA_FIM','label','Data de encerramento','type','date','required',false,'group','Vigência'),
    jsonb_build_object('key','CONTRATO.RENOVACAO','label','Regra de renovação','type','text','required',true,'group','Vigência'),
    jsonb_build_object('key','CONTRATO.VALOR','label','Valor contratual','type','currency','required',false,'group','Financeiro'),
    jsonb_build_object('key','CONTRATO.FATURAMENTO','label','Frequência de faturamento','type','text','required',true,'group','Financeiro'),
    jsonb_build_object('key','CONTRATO.PRAZO_PAGAMENTO_DIAS','label','Prazo de pagamento em dias','type','number','required',true,'group','Financeiro'),
    jsonb_build_object('key','CONTRATO.OBSERVACOES','label','Observações específicas','type','textarea','required',false,'group','Condições')
  ),
  party_roles = array['CONTRATANTE','CONTRATADA'],
  signature_roles = array['CONTRATANTE','CONTRATADA'],
  header_text = 'LANDER SOLUTIONS — CONTRATO DE SOFTWARE COMO SERVIÇO',
  footer_text = 'Documento gerado a partir de template versionado no Sistema Central LANDER SOLUTIONS',
  updated_at = now()
where code = 'TPL_CLIENTE_SAAS';

update public.contract_templates
set
  body_text = $template$
CONTRATO DE PARTICIPAÇÃO ECONÔMICA E REPASSE

Pelo presente instrumento, {{CONTRATANTE.RAZAO_SOCIAL}}, inscrita no CPF/CNPJ sob nº {{CONTRATANTE.CPF_CNPJ}}, e {{PARTICIPANTE.NOME_RAZAO_SOCIAL}}, inscrito(a) no CPF/CNPJ sob nº {{PARTICIPANTE.CPF_CNPJ}}, estabelecem as regras de participação econômica descritas abaixo.

1. OBJETO
1.1. O PARTICIPANTE fará jus à participação de {{PARTICIPACAO.PERCENTUAL}}% sobre {{PARTICIPACAO.BASE_CALCULO}}.

2. COMPONENTES DA APURAÇÃO
2.1. Serão incluídos: {{PARTICIPACAO.COMPONENTES_INCLUIDOS}}.
2.2. Serão excluídos: {{PARTICIPACAO.COMPONENTES_EXCLUIDOS}}.

3. PREJUÍZOS, INVESTIMENTOS E RESERVAS
3.1. Prejuízos: {{PARTICIPACAO.REGRA_PREJUIZO}}.
3.2. Investimentos: {{PARTICIPACAO.REGRA_INVESTIMENTO}}.
3.3. Reserva: {{PARTICIPACAO.REGRA_RESERVA}}.

4. PAGAMENTO
4.1. O repasse será realizado em até {{PARTICIPACAO.PRAZO_PAGAMENTO_DIAS}} dias após a aprovação da apuração.

5. VIGÊNCIA
5.1. Início: {{CONTRATO.DATA_INICIO}}. Encerramento: {{CONTRATO.DATA_FIM}}.

6. OBSERVAÇÕES
6.1. {{CONTRATO.OBSERVACOES}}.

{{SIGNATURE.CONTRATANTE}}
{{SIGN_DATE.CONTRATANTE}}

{{SIGNATURE.PARTICIPANTE}}
{{SIGN_DATE.PARTICIPANTE}}
$template$,
  variables_manifest = jsonb_build_array(
    jsonb_build_object('key','PARTICIPACAO.PERCENTUAL','label','Percentual de participação','type','percentage','required',true,'group','Participação'),
    jsonb_build_object('key','PARTICIPACAO.BASE_CALCULO','label','Base de cálculo','type','textarea','required',true,'group','Apuração'),
    jsonb_build_object('key','PARTICIPACAO.COMPONENTES_INCLUIDOS','label','Componentes incluídos','type','textarea','required',true,'group','Apuração'),
    jsonb_build_object('key','PARTICIPACAO.COMPONENTES_EXCLUIDOS','label','Componentes excluídos','type','textarea','required',false,'group','Apuração'),
    jsonb_build_object('key','PARTICIPACAO.REGRA_PREJUIZO','label','Regra para prejuízos','type','textarea','required',true,'group','Regras econômicas'),
    jsonb_build_object('key','PARTICIPACAO.REGRA_INVESTIMENTO','label','Regra para investimentos','type','textarea','required',true,'group','Regras econômicas'),
    jsonb_build_object('key','PARTICIPACAO.REGRA_RESERVA','label','Regra de reserva','type','textarea','required',false,'group','Regras econômicas'),
    jsonb_build_object('key','PARTICIPACAO.PRAZO_PAGAMENTO_DIAS','label','Prazo de pagamento em dias','type','number','required',true,'group','Pagamento'),
    jsonb_build_object('key','CONTRATO.DATA_INICIO','label','Data de início','type','date','required',true,'group','Vigência'),
    jsonb_build_object('key','CONTRATO.DATA_FIM','label','Data de encerramento','type','date','required',false,'group','Vigência'),
    jsonb_build_object('key','CONTRATO.OBSERVACOES','label','Observações específicas','type','textarea','required',false,'group','Condições')
  ),
  party_roles = array['CONTRATANTE','PARTICIPANTE'],
  signature_roles = array['CONTRATANTE','PARTICIPANTE'],
  header_text = 'LANDER SOLUTIONS — CONTRATO DE PARTICIPAÇÃO ECONÔMICA',
  footer_text = 'Documento gerado a partir de template versionado no Sistema Central LANDER SOLUTIONS',
  updated_at = now()
where code = 'TPL_PARTICIPACAO';

comment on column public.contract_templates.variables_manifest is 'Manifesto dos campos editáveis do template contratual.';
comment on column public.contract_templates.party_roles is 'Papéis de partes exigidos pelo conteúdo do template.';
comment on column public.contract_templates.signature_roles is 'Papéis de signatários exigidos pelo conteúdo do template.';
comment on column public.contract_versions.party_snapshot is 'Snapshot imutável das partes utilizado para renderizar a versão.';
comment on column public.contract_versions.template_variables is 'Valores das variáveis do template na versão contratual.';
comment on column public.contract_versions.signers_snapshot is 'Snapshot ordenado dos signatários da versão contratual.';
comment on column public.contract_versions.rendered_body is 'Corpo integral renderizado para a versão contratual.';
