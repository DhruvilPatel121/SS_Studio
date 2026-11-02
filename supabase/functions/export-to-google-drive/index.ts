/**
 * export-to-google-drive Edge Function
 * Follows .skills/google-drive/references/edge-function.md
 * Exports event photos directly to a new folder in Google Drive.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const CREATE_FOLDER_URL = 'https://app-eaujrj6ph0xt-api-connect-google-drive-create-folder.gateway.appmedo.com/';
const UPLOAD_URL = 'https://app-eaujrj6ph0xt-api-connect-google-drive-upload-url.gateway.appmedo.com/';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
  }

  const gatewayJwt = Deno.env.get('INTEGRATIONS_API_KEY');
  const connection = Deno.env.get('MEDO_CONNECT_GOOGLE_DRIVE');

  if (!gatewayJwt || !connection) {
    return jsonResponse({
      error: {
        code: 'CONNECTION_REQUIRED',
        message: 'Google Drive authorization is required. Please authorize Google Drive in the platform Skill settings to enable automatic export.',
      },
    }, 400);
  }

  try {
    const { folder_name = 'CamSort Event Photos', photos = [] } = await req.json();

    if (!Array.isArray(photos) || photos.length === 0) {
      return jsonResponse({ error: { code: 'INVALID_ARGUMENTS', message: 'No photos provided to export' } }, 400);
    }

    // 1. Create target folder in Google Drive root
    const createFolderRes = await fetch(CREATE_FOLDER_URL, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Authorization': `Bearer ${gatewayJwt}`,
      },
      body: JSON.stringify({
        connected_account_id: connection,
        arguments: { name: folder_name },
      }),
    });

    const folderResult = await createFolderRes.json().catch(() => null);
    if (!createFolderRes.ok || !folderResult?.successful) {
      const isConn = folderResult?.error?.code === 'CONNECTION_REQUIRED' || folderResult?.error?.message?.includes('Connect');
      return jsonResponse({
        error: {
          code: isConn ? 'CONNECTION_REQUIRED' : 'PROVIDER_ERROR',
          message: folderResult?.error?.message || 'Failed to create folder in Google Drive. Make sure Google Drive is connected.',
        },
      }, isConn ? 400 : 502);
    }

    const folderId = folderResult?.data?.id || folderResult?.data?.folderId;

    // 2. Upload photos to the created folder
    let uploadedCount = 0;
    const errors: string[] = [];

    // Process up to 20 photos in sequence/small batches to prevent timeouts
    const uploadBatch = photos.slice(0, 50);
    for (const photo of uploadBatch) {
      if (!photo.url) continue;
      try {
        const uploadRes = await fetch(UPLOAD_URL, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Authorization': `Bearer ${gatewayJwt}`,
          },
          body: JSON.stringify({
            connected_account_id: connection,
            arguments: {
              name: photo.name || `photo-${uploadedCount + 1}.jpg`,
              sourceUrl: photo.url,
              parentFolderId: folderId || undefined,
            },
          }),
        });

        const upData = await uploadRes.json().catch(() => null);
        if (uploadRes.ok && upData?.successful) {
          uploadedCount++;
        } else {
          errors.push(photo.name || 'photo');
        }
      } catch (err: any) {
        errors.push(err?.message || 'upload error');
      }
    }

    return jsonResponse({
      success: true,
      folderId,
      folderName: folder_name,
      uploadedCount,
      totalRequested: uploadBatch.length,
    });
  } catch (err: any) {
    return jsonResponse({
      error: { code: 'SERVER_ERROR', message: err?.message || 'Unexpected server error during Google Drive export' },
    }, 500);
  }
});