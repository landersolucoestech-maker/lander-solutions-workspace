# Domínio — Customer Operations / Atendimento e Suporte

## Fonte de verdade existente

- Tenant equivalente: `legal_entities.id`.
- Produto: `products.id`.
- Unidade: `business_units.id` e `business_units.code` para escopo RBAC.
- Usuário/agente: `profiles.id`.
- Contato e organização: `parties.id`.
- Auditoria: `audit_events`.

## Entidades novas

- `support_product_settings`: identidade, idioma, timezone e fallback por produto.
- `support_product_members`: acesso operacional de usuários por produto.
- `support_channels`: adaptadores e estado explícito do canal.
- `support_queues`: filas compartilhadas ou específicas por produto.
- `support_queue_members`: agentes e supervisores elegíveis.
- `support_categories` e `support_tags`.
- `support_business_hours`, `support_business_hour_intervals`, `support_holidays`.
- `support_sla_policies` e `support_escalation_rules`.
- `support_message_templates`.
- `support_forms` e `support_form_fields`.
- `support_automation_flows`, `support_automation_versions`, `support_routing_options`.
- `support_external_identities`: IDs externos de contatos por produto/integração.
- `support_conversations`, `support_messages`.
- `support_tickets`, `support_ticket_events`, `support_assignments`.
- `support_notifications`, `support_webhook_events`, `support_outbox`.

## Estados

### Conversa

`new`, `automation`, `waiting_for_customer`, `waiting_for_agent`, `open`, `pending`, `resolved`, `closed`.

### Ticket

`new`, `open`, `pending`, `waiting_for_customer`, `waiting_for_agent`, `resolved`, `closed`.

### Automação

Fluxo: `active`, `inactive`, `archived`.

Versão: `draft`, `published`, `archived`.

### Canais

`not_configured`, `configured`, `active`, `disabled`, `error`.

### Prioridades

`low`, `normal`, `high`, `urgent`, `critical`.

## Regras centrais

1. Toda conversa e ticket possui `legal_entity_id` e `product_id` obrigatórios.
2. O produto deve pertencer a uma unidade da mesma pessoa jurídica.
3. Filas compartilhadas podem ter `product_id` nulo; filas específicas não podem ser usadas por outro produto.
4. Agentes precisam estar ativos, vinculados ao produto e à fila.
5. Publicar automação nunca altera a versão publicada; gera histórico imutável.
6. Conversas preservam a versão de automação usada no início.
7. Templates e formulários referenciados não são excluídos; são arquivados.
8. Toda mutação relevante gera auditoria e eventos de ticket/conversa.
9. Optimistic locking usa `version`.
10. Integrações externas ficam desativadas enquanto não houver credencial e adaptador reais.
11. O executor de SLA/escalonamentos é idempotente e processa registros persistidos; não existe botão global de produção.

## Permissões

- `support.read`
- `support.operate`
- `support.manage`
- `support.publish`
- `support.reports.read`
- `support.audit.read`

Papéis novos:

- `support_admin`
- `support_manager`
- `support_supervisor`
- `support_agent`
- `support_viewer`

O papel `owner` recebe todas as permissões. Os demais recebem somente o conjunto compatível com sua função.
