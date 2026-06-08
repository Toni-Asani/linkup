update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'application/pdf'
]
where id = 'need-attachments';

drop policy if exists "Company realizations shared storage select" on storage.objects;

create policy "Company realizations shared storage select" on storage.objects
for select using (
  bucket_id = 'need-attachments'
  and exists (
    select 1 from public.company_realizations cr
    where cr.storage_path = storage.objects.name
      and cr.status = 'active'
      and cr.moderation_status = 'approved'
  )
);
