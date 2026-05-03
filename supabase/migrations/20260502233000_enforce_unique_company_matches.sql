-- Keep only one match for the same unordered pair of companies.
delete from public.matches m
using public.matches keep
where m.id::text > keep.id::text
  and least(m.company_a::text, m.company_b::text) = least(keep.company_a::text, keep.company_b::text)
  and greatest(m.company_a::text, m.company_b::text) = greatest(keep.company_a::text, keep.company_b::text);

create unique index if not exists matches_unique_company_pair_idx
on public.matches (
  least(company_a::text, company_b::text),
  greatest(company_a::text, company_b::text)
)
where company_a is not null and company_b is not null;
