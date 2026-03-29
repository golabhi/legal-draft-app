'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Link from 'next/link'
import { format } from 'date-fns'

interface Client {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState('')

  const supabase = createClient()

  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('clients').select('*').eq('lawyer_id', user.id).order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', address: '', notes: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    setForm({ name: client.name, phone: client.phone || '', address: client.address || '', notes: client.notes || '' })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editing) {
      const { error } = await supabase.from('clients').update({
        name: form.name, phone: form.phone || null, address: form.address || null, notes: form.notes || null,
      }).eq('id', editing.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('clients').insert({
        lawyer_id: user.id, name: form.name, phone: form.phone || null, address: form.address || null, notes: form.notes || null,
      })
      if (error) { setError(error.message); setSaving(false); return }
    }

    await fetchClients()
    setModalOpen(false)
    setSaving(false)
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')

    // 1. Get all cases belonging to this client
    const { data: cases } = await supabase
      .from('cases')
      .select('id')
      .eq('client_id', deleteTarget.id)

    const caseIds = (cases || []).map((c) => c.id)

    // 2. Nullify case references in documents so FK doesn't block case deletion
    if (caseIds.length > 0) {
      await supabase.from('documents').update({ case_id: null }).in('case_id', caseIds)
      await supabase.from('cases').delete().in('id', caseIds)
    }

    // 3. Delete the client
    const { error: err } = await supabase.from('clients').delete().eq('id', deleteTarget.id)
    if (err) {
      setDeleteError(err.message)
      setDeleting(false)
      return
    }

    showToast('Client deleted')
    await fetchClients()
    setDeleting(false)
    setDeleteModal(false)
  }

  const filtered = clients.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}
      <Header
        title="Clients"
        subtitle="Manage your client directory"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 w-52" />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Client
            </button>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">{search ? 'No clients found' : 'No clients yet'}</p>
            {!search && <button onClick={openCreate} className="mt-3 text-sm text-navy-700 hover:underline">Add your first client</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((client) => (
              <div key={client.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-navy-700">{client.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{client.name}</h3>
                      {client.phone && <p className="text-xs text-gray-500">{client.phone}</p>}
                    </div>
                  </div>
                </div>
                {client.address && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{client.address}</p>}
                <p className="text-xs text-gray-400 mb-3">Added {format(new Date(client.created_at), 'MMM d, yyyy')}</p>
                <div className="flex gap-2">
                  <Link href={`/dashboard/clients/${client.id}`} className="flex-1 px-3 py-1.5 text-xs text-center bg-navy-50 hover:bg-navy-100 text-navy-700 rounded-lg font-medium">
                    View
                  </Link>
                  <button onClick={() => openEdit(client)} className="flex-1 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg">
                    Edit
                  </button>
                  <button onClick={() => { setDeleteTarget(client); setDeleteError(''); setDeleteModal(true) }} className="flex-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Client">
        {deleteTarget && (
          <div className="space-y-4">
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">{deleteError}</div>
            )}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Delete "{deleteTarget.name}"?</p>
                <p className="text-xs text-red-600 mt-1">
                  This will permanently delete the client and all their associated cases. Generated documents will be kept but unlinked from the case.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Deleting...</>
                ) : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'Add New Client'}>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" placeholder="Client full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" placeholder="Client address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" placeholder="Additional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-navy-800 hover:bg-navy-900 rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update Client' : 'Add Client'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
