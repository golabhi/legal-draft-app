import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Link from 'next/link'
import { format, startOfMonth } from 'date-fns'

export const runtime = 'edge'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const monthStart = startOfMonth(new Date()).toISOString()

  const [
    { count: totalLawyers },
    { count: totalTemplates },
    { count: totalDocuments },
    { count: totalGroups },
    { count: thisMonthDocs },
    { data: allDocuments },
    { data: allProfiles },
    { data: recentDocs },
    { data: recentPurchases },
    { data: allPurchases },
    { data: thisMonthPurchases },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'lawyer'),
    supabase.from('templates').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('template_groups').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('documents').select('template_id, lawyer_id, created_at, templates(name)'),
    supabase.from('profiles').select('id, full_name, email'),
    supabase
      .from('documents')
      .select('*, templates(name), profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('purchases')
      .select('*, profiles(full_name, email), templates(name), template_groups(name)')
      .order('purchase_date', { ascending: false })
      .limit(5),
    supabase.from('purchases').select('amount_paid'),
    supabase.from('purchases').select('amount_paid').gte('purchase_date', monthStart),
  ])

  // Compute total revenue
  const totalRevenue = (allPurchases ?? []).reduce((sum: number, p: any) => sum + (p.amount_paid ?? 0), 0)
  const thisMonthRevenue = (thisMonthPurchases ?? []).reduce((sum: number, p: any) => sum + (p.amount_paid ?? 0), 0)

  // Compute mostUsedTemplates from documents
  const templateCountMap: Record<string, { name: string; count: number }> = {}
  for (const doc of allDocuments ?? []) {
    const tid = doc.template_id
    if (!tid) continue
    const name = (doc as any).templates?.name ?? 'Unknown Template'
    if (!templateCountMap[tid]) templateCountMap[tid] = { name, count: 0 }
    templateCountMap[tid].count++
  }
  const mostUsedTemplates = Object.entries(templateCountMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const maxTemplateCount = mostUsedTemplates[0]?.count ?? 1

  // Compute topUsers from documents
  const profileMap: Record<string, { full_name: string | null; email: string | null }> = {}
  for (const p of allProfiles ?? []) {
    profileMap[p.id] = { full_name: p.full_name, email: p.email }
  }
  const userDocCountMap: Record<string, number> = {}
  for (const doc of allDocuments ?? []) {
    const lid = doc.lawyer_id
    if (!lid) continue
    userDocCountMap[lid] = (userDocCountMap[lid] ?? 0) + 1
  }
  const topUsers = Object.entries(userDocCountMap)
    .map(([id, count]) => ({ id, count, ...( profileMap[id] ?? { full_name: null, email: null }) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const stats = [
    {
      label: 'Total Lawyers',
      value: totalLawyers ?? 0,
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      bg: 'bg-blue-50',
    },
    {
      label: 'Templates',
      value: totalTemplates ?? 0,
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bg: 'bg-purple-50',
    },
    {
      label: 'Documents Generated',
      value: totalDocuments ?? 0,
      icon: (
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      bg: 'bg-green-50',
    },
    {
      label: 'Total Revenue (₹)',
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      icon: (
        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-orange-50',
    },
    {
      label: 'This Month Revenue (₹)',
      value: `₹${thisMonthRevenue.toLocaleString('en-IN')}`,
      icon: (
        <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      bg: 'bg-teal-50',
    },
  ]

  return (
    <div>
      <Header title="Admin Dashboard" subtitle="Overview of platform activity" />

      <div className="p-6 space-y-6">

        {/* Row 1: Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 ${stat.bg} rounded-lg flex items-center justify-center`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Row 2: Most Used Templates + Top Active Users */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Most Used Templates */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Most Used Templates</h2>
            {mostUsedTemplates.length > 0 ? (
              <div className="space-y-3">
                {mostUsedTemplates.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-44 truncate flex-shrink-0">{t.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-navy-600"
                        style={{ width: `${(t.count / maxTemplateCount) * 100}%`, backgroundColor: '#1e3a5f' }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right flex-shrink-0">{t.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No documents generated yet</p>
            )}
          </div>

          {/* Top Active Users */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Top Active Users</h2>
            {topUsers.length > 0 ? (
              <div className="space-y-3">
                {topUsers.map((u) => (
                  <Link
                    key={u.id}
                    href={`/admin/users/${u.id}`}
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold" style={{ backgroundColor: '#1e3a5f' }}>
                      {u.full_name?.charAt(0) || u.email?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {u.count}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
            )}
          </div>
        </div>

        {/* Row 3: Recent Documents + Recent Purchases */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Documents */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Documents</h2>
            {recentDocs && recentDocs.length > 0 ? (
              <div className="space-y-3">
                {recentDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name || 'Untitled Document'}</p>
                      <p className="text-xs text-gray-500 truncate">{doc.profiles?.full_name || doc.profiles?.email || 'Unknown user'}</p>
                      {doc.templates?.name && (
                        <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {doc.templates.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                      {doc.created_at ? format(new Date(doc.created_at), 'MMM d') : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No documents generated yet</p>
            )}
          </div>

          {/* Recent Purchases */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Purchases</h2>
            {recentPurchases && recentPurchases.length > 0 ? (
              <div className="space-y-3">
                {recentPurchases.map((p: any) => {
                  const itemName = p.templates?.name || p.template_groups?.name || 'Unknown Item'
                  const isGroup = !!p.template_groups?.name
                  return (
                    <div key={p.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.profiles?.full_name || p.profiles?.email || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 truncate">{itemName}</p>
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${isGroup ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {isGroup ? 'Group' : 'Template'}
                        </span>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900">₹{(p.amount_paid ?? 0).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-gray-400">
                          {p.purchase_date ? format(new Date(p.purchase_date), 'MMM d') : '—'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No purchases yet</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
