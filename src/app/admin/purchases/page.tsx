import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import PurchasesClient from './PurchasesClient'

export const runtime = 'edge'

export default async function AdminPurchasesPage() {
  const supabase = await createClient()

  const { data: rawPurchases } = await supabase
    .from('purchases')
    .select('*, template_groups(name), templates(name)')
    .order('purchase_date', { ascending: false })

  // purchases.lawyer_id → auth.users (no direct FK to profiles), so fetch separately
  const lawyerIds = [...new Set((rawPurchases || []).map((p: any) => p.lawyer_id as string))]

  const { data: profiles } = lawyerIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', lawyerIds)
    : { data: [] }

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

  const purchases = (rawPurchases || []).map((p: any) => ({
    ...p,
    profiles: profileMap.get(p.lawyer_id) ?? null,
  }))

  return (
    <div>
      <Header title="Purchase Management" subtitle="All user purchases, revenue analytics & validity management" />
      <PurchasesClient initialPurchases={purchases} />
    </div>
  )
}
