import supabase from './db-client.js';

const BUCKET = 'hospital-documents';

/** Ensure the storage bucket exists (idempotent, non-fatal). */
async function ensureBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: false });
    }
  } catch (e) {
    // Non-fatal: bucket may already exist or key may lack admin rights
    console.warn('[documents] ensureBucket warning:', e?.message || e);
  }
}

/** Insert a notification for Admin and Receptionist roles. */
async function insertNotif(title, message, type = 'Document') {
  for (const role of ['Admin', 'Receptionist']) {
    await supabase.from('notifications').insert({
      type,
      title,
      message,
      target_role: role,
      is_read: false,
    });
  }
}

/**
 * Check all documents and push notifications for:
 * - Documents expiring in 7 days (warning)
 * - Documents expiring in 1 day (critical)
 * - Documents expired today (expired alert)
 */
async function checkAndNotifyExpiry() {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7ISO = in7.toISOString().slice(0, 10);

  const in1 = new Date(today);
  in1.setDate(in1.getDate() + 1);
  const in1ISO = in1.toISOString().slice(0, 10);

  const { data: docs } = await supabase
    .from('hospital_documents')
    .select('id, title, document_type, expiry_date, notified_7d, notified_1d, notified_expired')
    .not('expiry_date', 'is', null);

  if (!docs) return;

  for (const doc of docs) {
    const exp = doc.expiry_date;
    if (!exp) continue;

    // Expired today
    if (exp === todayISO && !doc.notified_expired) {
      await insertNotif(
        `⚠️ Document Expired: ${doc.title}`,
        `The document "${doc.title}" (${doc.document_type}) has expired today (${exp}). Please renew or remove it.`,
        'Critical'
      );
      await supabase.from('hospital_documents').update({ notified_expired: true }).eq('id', doc.id);
    }

    // Expiring in 1 day
    if (exp === in1ISO && !doc.notified_1d) {
      await insertNotif(
        `🔔 Document Expiring Tomorrow: ${doc.title}`,
        `The document "${doc.title}" (${doc.document_type}) expires tomorrow (${exp}). Take action immediately.`,
        'Critical'
      );
      await supabase.from('hospital_documents').update({ notified_1d: true }).eq('id', doc.id);
    }

    // Expiring in 7 days
    if (exp === in7ISO && !doc.notified_7d) {
      await insertNotif(
        `📋 Document Expiring in 7 Days: ${doc.title}`,
        `The document "${doc.title}" (${doc.document_type}) will expire on ${exp}. Please plan for renewal.`,
        'Document'
      );
      await supabase.from('hospital_documents').update({ notified_7d: true }).eq('id', doc.id);
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await ensureBucket();

    // GET /api/documents
    if (req.method === 'GET') {
      // Trigger expiry check on every GET (acts as a daily-ish cron via polling)
      checkAndNotifyExpiry().catch(console.error);

      let q = supabase
        .from('hospital_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (req.query?.type) q = q.eq('document_type', req.query.type);
      if (req.query?.status) q = q.eq('status', req.query.status);
      if (req.query?.search) {
        q = q.or(`title.ilike.%${req.query.search}%,document_type.ilike.%${req.query.search}%,uploaded_by.ilike.%${req.query.search}%`);
      }

      const { data, error } = await q.limit(100);
      if (error) throw error;

      // Generate signed URLs for each document
      const enriched = await Promise.all(
        (data || []).map(async (doc) => {
          if (doc.file_path) {
            const { data: urlData } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(doc.file_path, 3600); // 1 hour
            return { ...doc, file_url: urlData?.signedUrl || null };
          }
          return { ...doc, file_url: null };
        })
      );

      return res.status(200).json(enriched);
    }

    // POST /api/documents — create document record (file uploaded separately via signed URL)
    if (req.method === 'POST') {
      const {
        title,
        document_type,
        description,
        expiry_date,
        uploaded_by,
        uploaded_by_role,
        file_name,
        file_size,
        file_mime,
      } = req.body;

      if (!title || !document_type || !uploaded_by) {
        return res.status(400).json({ error: 'title, document_type and uploaded_by are required' });
      }

      // Determine initial status based on expiry
      let status = 'Active';
      if (expiry_date) {
        const today = new Date().toISOString().slice(0, 10);
        if (expiry_date < today) status = 'Expired';
        else {
          const daysLeft = Math.ceil((new Date(expiry_date) - new Date()) / 864e5);
          if (daysLeft <= 7) status = 'Expiring Soon';
        }
      }

      // Generate a unique file path for upload
      const ext = file_name ? file_name.split('.').pop() : 'bin';
      const slug = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const file_path = `${document_type.replace(/\s+/g, '_')}/${slug}`;

      // Create a signed upload URL so the frontend can PUT the file directly
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(file_path);

      if (uploadErr) throw uploadErr;

      // Insert document record
      const { data: doc, error: insertErr } = await supabase
        .from('hospital_documents')
        .insert({
          title,
          document_type,
          description: description || null,
          expiry_date: expiry_date || null,
          uploaded_by,
          uploaded_by_role: uploaded_by_role || null,
          file_name: file_name || null,
          file_size: file_size || null,
          file_mime: file_mime || null,
          file_path,
          status,
          notified_7d: false,
          notified_1d: false,
          notified_expired: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Push a "document uploaded" notification
      await insertNotif(
        `📄 New Document Uploaded: ${title}`,
        `"${title}" (${document_type}) was uploaded by ${uploaded_by}${expiry_date ? `. Expires: ${expiry_date}` : '.'}`
      );

      // If expiry soon, also fire that notification right away
      if (expiry_date) {
        const daysLeft = Math.ceil((new Date(expiry_date) - new Date()) / 864e5);
        if (daysLeft <= 7 && daysLeft > 0) {
          await insertNotif(
            `⚠️ Document Expiring in ${daysLeft} Day(s): ${title}`,
            `"${title}" (${document_type}) expires on ${expiry_date}. Please renew in time.`,
            'Critical'
          );
        } else if (daysLeft <= 0) {
          await insertNotif(
            `❌ Expired Document Uploaded: ${title}`,
            `"${title}" (${document_type}) was uploaded but has already expired (${expiry_date}).`,
            'Critical'
          );
        }
      }

      return res.status(201).json({ document: doc, signedUploadUrl: uploadData?.signedUrl, path: file_path });
    }

    // PUT /api/documents — update document metadata
    if (req.method === 'PUT') {
      const { id, ...payload } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      // Recalculate status if expiry_date changed
      if (payload.expiry_date !== undefined) {
        const today = new Date().toISOString().slice(0, 10);
        if (!payload.expiry_date) {
          payload.status = 'Active';
        } else if (payload.expiry_date < today) {
          payload.status = 'Expired';
        } else {
          const daysLeft = Math.ceil((new Date(payload.expiry_date) - new Date()) / 864e5);
          payload.status = daysLeft <= 7 ? 'Expiring Soon' : 'Active';
        }
        // Reset notification flags when expiry date is updated
        payload.notified_7d = false;
        payload.notified_1d = false;
        payload.notified_expired = false;
      }

      const { data, error } = await supabase
        .from('hospital_documents')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    // DELETE /api/documents
    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ error: 'id is required' });

      // Get file path first so we can remove from storage
      const { data: doc } = await supabase
        .from('hospital_documents')
        .select('file_path')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('hospital_documents').delete().eq('id', id);
      if (error) throw error;

      // Remove from storage if exists
      if (doc?.file_path) {
        await supabase.storage.from(BUCKET).remove([doc.file_path]);
      }

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error (documents):', err);
    res.status(500).json({ error: err.message });
  }
}
