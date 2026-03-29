import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { templateId, caseId, language: requestedLang, variables } = await request.json()

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*, template_groups(id, name, is_free)')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check access: free, group purchased, or individual template purchased
    let hasAccess = template.is_free

    if (!hasAccess && template.template_group_id && template.template_groups?.is_free) {
      hasAccess = true
    }

    if (!hasAccess) {
      const checks = []
      // Check individual template purchase
      checks.push(
        supabase.from('purchases').select('id')
          .eq('lawyer_id', user.id).eq('template_id', templateId).eq('is_active', true).maybeSingle()
      )
      // Check group purchase
      if (template.template_group_id) {
        checks.push(
          supabase.from('purchases').select('id')
            .eq('lawyer_id', user.id).eq('template_group_id', template.template_group_id).eq('is_active', true).maybeSingle()
        )
      }
      const results = await Promise.all(checks)
      hasAccess = results.some((r) => !!r.data)
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this template. Please purchase it from the marketplace.' }, { status: 403 })
    }

    let fileUrl: string | null = null
    let fileName: string

    // Resolve language: customer's explicit choice > template's stored language > default 'en'
    const resolvedLang = requestedLang || (template as any).language || 'en'
    const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === resolvedLang)

    // Auto-injected vars are placed AFTER user variables so they always win —
    // customer can never accidentally override language/font by leaving a field blank
    const enrichedVariables = {
      ...(variables || {}),
      language: resolvedLang,
      language_name: langInfo?.name || 'English',
      font_family: (template as any).font_family || 'Times New Roman',
    }

    // If template has a file, download and process with docxtemplater
    if (template.file_url) {
      try {
        // Dynamically import to avoid SSR issues
        const PizZip = (await import('pizzip')).default
        const Docxtemplater = (await import('docxtemplater')).default

        // Fetch the template file
        const fileResponse = await fetch(template.file_url)
        if (!fileResponse.ok) {
          throw new Error('Failed to fetch template file')
        }

        const fileBuffer = await fileResponse.arrayBuffer()
        const zip = new PizZip(fileBuffer)

        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: '{{', end: '}}' },
        })

        try {
          doc.render(enrichedVariables)
        } catch (renderError: any) {
          return NextResponse.json({
            error: 'Template rendering error: ' + (renderError.message || 'Unknown error'),
          }, { status: 400 })
        }

        const output = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        })

        // Upload generated document to Supabase Storage
        fileName = `${user.id}/${Date.now()}-${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.docx`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('generated-documents')
          .upload(fileName, output, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          // Store record without file URL
          fileUrl = null
        } else {
          const { data: signedUrlData } = await supabase.storage
            .from('generated-documents')
            .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7 days

          fileUrl = signedUrlData?.signedUrl || null
        }
      } catch (docError: any) {
        console.error('Document generation error:', docError)
        // Fall through to create record without file
      }
    }

    fileName = `${template.name} - ${new Date().toLocaleDateString('en-IN')}.docx`

    // Save document record
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        lawyer_id: user.id,
        case_id: caseId || null,
        template_id: templateId,
        file_url: fileUrl,
        file_name: fileName,
        variables_used: enrichedVariables ?? variables ?? {},
      })
      .select()
      .single()

    if (docError) {
      return NextResponse.json({ error: 'Failed to save document record: ' + docError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      document: docRecord,
      fileUrl,
      message: template.file_url
        ? (fileUrl ? 'Document generated and ready for download' : 'Document record created (file generation had an issue)')
        : 'Document record created (no template file uploaded)',
    })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
