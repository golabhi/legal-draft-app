import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import { format } from 'date-fns'

export const runtime = 'edge'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('lawyer_id', user.id)
    .single()

  if (!client) notFound()

  const { data: cases } = await supabase
    .from('cases')
    .select('*')
    .eq('client_id', id)
    .eq('lawyer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <Header
        title={client.name}
        subtitle="Client Details"
        actions={
          <Link href="/dashboard/clients" className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Back to Clients
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Client Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-navy-700">{client.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {client.phone}
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{client.address}</span>
                  </div>
                )}
              </div>
              {client.notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{client.notes}</p>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">Client since {format(new Date(client.created_at), 'MMMM d, yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Cases */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Cases ({cases?.length || 0})</h2>
            <Link
              href="/dashboard/cases"
              className="text-sm text-navy-700 hover:underline"
            >
              View all cases
            </Link>
          </div>

          {cases && cases.length > 0 ? (
            <div className="space-y-3">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/cases/${c.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">{c.case_type || 'General'} • {format(new Date(c.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.status === 'Closed' ? 'bg-gray-100 text-gray-600' :
                    c.status === 'Active' ? 'bg-green-100 text-green-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {c.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              No cases for this client yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
