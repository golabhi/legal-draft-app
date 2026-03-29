'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Link from 'next/link'
import { format } from 'date-fns'

interface Document {
  id: string
  file_name: string | null
  file_url: string | null
  created_at: string
  case_id: string | null
  template_id: string | null
  templates?: { name: string }
  cases?: { title: string }
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const supabase = createClient()

  const fetchDocuments = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('documents')
      .select('*, templates(name), cases(title)')
      .eq('lawyer_id', user.id)
      .order('created_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchDocuments() }, [])

  const filtered = documents.filter((d) =>
    !search ||
    d.file_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.templates?.name.toLowerCase().includes(search.toLowerCase()) ||
    d.cases?.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Header
        title="Generated Documents"
        subtitle="All documents generated from templates"
        actions={
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 w-64" />
          </div>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">{search ? 'No documents found' : 'No documents generated yet'}</p>
            {!search && (
              <p className="text-gray-400 text-sm mt-1">Generate documents from your case pages</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Template</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Case</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Generated</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 truncate max-w-xs">{doc.file_name || 'Document'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{doc.templates?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {doc.case_id && doc.cases ? (
                        <Link href={`/dashboard/cases/${doc.case_id}`} className="text-navy-700 hover:underline">
                          {doc.cases.title}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}</td>
                    <td className="px-4 py-3">
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          download={doc.file_name || 'document.docx'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-navy-50 hover:bg-navy-100 text-navy-700 rounded-lg font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
