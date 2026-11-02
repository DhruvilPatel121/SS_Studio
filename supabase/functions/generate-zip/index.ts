/**
 * generate-zip Edge Function
 * POST { event_id, session_token? }
 *
 * Actual column names (verified from schema):
 *   photos:         id, storage_key, thumbnail_key, original_name
 *   face_embeddings: photo_id, guest_profile_id, quality
 *   guest_profiles: id, event_id, session_token
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { event_id, session_token, photo_ids } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: 'event_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let photoRows: Array<{ id: string; storage_key: string; original_name: string }> = [];

    if (Array.isArray(photo_ids) && photo_ids.length > 0) {
      // Specific selected photos
      const { data: photos } = await supabase
        .from('photos')
        .select('id, storage_key, original_name')
        .in('id', photo_ids)
        .limit(500);
      photoRows = photos ?? [];
    } else if (session_token) {
      // Face-matched photos only
      const { data: guest } = await supabase
        .from('guest_profiles')
        .select('id')
        .eq('event_id', event_id)
        .eq('session_token', session_token)
        .maybeSingle();

      if (!guest) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: faces } = await supabase
        .from('face_embeddings')
        .select('photo_id')
        .eq('guest_profile_id', guest.id);

      const photoIds = (faces ?? []).map((f: any) => f.photo_id);
      if (!photoIds.length) {
        return new Response(JSON.stringify({ error: 'No matched photos found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: photos } = await supabase
        .from('photos')
        .select('id, storage_key, original_name')
        .in('id', photoIds)
        .limit(200);
      photoRows = photos ?? [];
    } else {
      // All photos for event
      const { data: photos } = await supabase
        .from('photos')
        .select('id, storage_key, original_name')
        .eq('event_id', event_id)
        .eq('processing_status', 'COMPLETED')
        .order('created_at', { ascending: true })
        .limit(500);
      photoRows = photos ?? [];
    }

    if (!photoRows.length) {
      return new Response(JSON.stringify({ error: 'No photos to zip' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build ZIP
    const zip = new JSZip();
    const folder = zip.folder('camsort-photos')!;

    const results = await Promise.allSettled(
      photoRows.map(async (p, idx) => {
        const { data, error } = await supabase.storage
          .from('event-photos')
          .download(p.storage_key);
        if (error || !data) throw new Error(`Failed: ${p.storage_key}`);
        const ext = p.original_name?.split('.').pop() ?? 'jpg';
        const filename = p.original_name ?? `photo-${String(idx + 1).padStart(4, '0')}.${ext}`;
        folder.file(filename, await data.arrayBuffer());
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    const succeeded = photoRows.length - failed;
    console.log(`Zipped ${succeeded}/${photoRows.length} photos`);

    if (succeeded === 0) {
      return new Response(JSON.stringify({ error: 'All photo downloads failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

    // Upload zip to Storage
    const zipKey = `${event_id}/${session_token ?? 'full'}-${Date.now()}.zip`;
    const { error: uploadErr } = await supabase.storage
      .from('zips')
      .upload(zipKey, zipBuffer, { contentType: 'application/zip', upsert: true });
    if (uploadErr) throw new Error(`ZIP upload failed: ${uploadErr.message}`);

    // Signed URL valid for 1 hour
    const { data: signed, error: signErr } = await supabase.storage
      .from('zips')
      .createSignedUrl(zipKey, 3600);
    if (signErr || !signed) throw new Error('Failed to create signed URL');

    return new Response(
      JSON.stringify({ url: signed.signedUrl, count: succeeded }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('generate-zip error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});