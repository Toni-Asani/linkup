import { supabase } from './supabaseClient'

export const NEED_OPPORTUNITY_NOTIFICATION_TYPE = 'new_need_opportunity'

export async function notifyNeedOpportunities({ companyId } = {}) {
  if (!companyId) return { ok: true, skipped: 'missing_company' }

  const { data, error } = await supabase.functions.invoke('notify-need-opportunities', {
    body: { companyId },
  })

  if (error) throw error
  return data
}
