insert into public.party_profiles (
  party_id,
  person_data,
  organization_data,
  address_data,
  created_by,
  updated_by
)
select
  p.id,
  case
    when p.party_type = 'person' then jsonb_build_object(
      'fullName', p.legal_name,
      'socialName', '',
      'cpf', p.tax_id,
      'rg', '',
      'rgIssuer', '',
      'rgState', '',
      'rgIssuedOn', '',
      'birthDate', '',
      'nationality', 'Brasileira',
      'birthplace', '',
      'maritalStatus', '',
      'profession', '',
      'gender', '',
      'motherName', '',
      'fatherName', '',
      'company', '',
      'jobTitle', '',
      'department', '',
      'companyCnpj', '',
      'professionalEmail', '',
      'professionalPhone', ''
    )
    else '{}'::jsonb
  end,
  case
    when p.party_type = 'organization' then jsonb_build_object(
      'legalName', p.legal_name,
      'tradeName', coalesce(p.trade_name, p.legal_name),
      'cnpj', p.tax_id,
      'stateRegistration', '',
      'stateRegistrationIndicator', 'non_taxpayer',
      'municipalRegistration', '',
      'openedOn', '',
      'legalNature', '',
      'companySize', '',
      'corporateType', '',
      'taxRegime', '',
      'primaryCnae', '',
      'secondaryCnaes', '',
      'shareCapital', '',
      'registrationStatus', 'ATIVA',
      'registrationStatusOn', '',
      'registrationAuthority', 'Receita Federal',
      'commercialRegistryNumber', '',
      'nire', '',
      'suframa', '',
      'simplesNacional', false,
      'mei', false,
      'withholdsTaxes', false,
      'withholdingRules', '',
      'invoiceEmail', '',
      'billingEmail', '',
      'preferredDueDay', '',
      'paymentTerms', '',
      'creditLimit', '',
      'defaultCurrency', coalesce(p.preferred_currency_code, 'BRL'),
      'fiscalNotes', ''
    )
    else '{}'::jsonb
  end,
  jsonb_build_object(
    'postalCode', coalesce(a.postal_code, ''),
    'street', coalesce(nullif(btrim(split_part(a.address_line_1, ',', 1)), ''), ''),
    'number', case
      when position(',' in coalesce(a.address_line_1, '')) > 0
        then btrim(substring(a.address_line_1 from position(',' in a.address_line_1) + 1))
      else ''
    end,
    'complement', coalesce(a.address_line_2, ''),
    'district', '',
    'city', coalesce(a.city, ''),
    'state', coalesce(a.state_region, ''),
    'country', coalesce(a.country_code, 'BR'),
    'reference', ''
  ),
  p.created_by,
  p.updated_by
from public.parties p
left join lateral (
  select pa.*
  from public.party_addresses pa
  where pa.party_id = p.id
    and pa.status = 'active'
  order by pa.is_primary desc, pa.created_at
  limit 1
) a on true
on conflict (party_id) do update
set person_data = excluded.person_data,
    organization_data = excluded.organization_data,
    address_data = excluded.address_data,
    updated_by = excluded.updated_by;

update public.party_contacts
set label = case
  when contact_type = 'email' and is_primary then 'E-mail principal'
  when contact_type = 'phone' and is_primary then 'Telefone principal'
  when contact_type = 'mobile' and is_primary then 'WhatsApp'
  else label
end
where status = 'active'
  and is_primary
  and contact_type in ('email', 'phone', 'mobile');
