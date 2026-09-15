// functions/strava-auth.js
// Cloudflare Pages Function — bytter en Strava OAuth-kode (eller refresh_token) mot access_token.
// Client secret hentes fra Cloudflare sine miljøvariabler/secrets (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)
// og eksponeres aldri til nettleseren. Filen havner automatisk på /strava-auth.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  const clientId = env.STRAVA_CLIENT_ID;
  const clientSecret = env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET mangler i Cloudflare sine miljøvariabler.' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: 'Ugyldig JSON' }, 400);
  }

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  if (payload.code) {
    params.append('code', payload.code);
    params.append('grant_type', 'authorization_code');
  } else if (payload.refresh_token) {
    params.append('refresh_token', payload.refresh_token);
    params.append('grant_type', 'refresh_token');
  } else {
    return json({ error: 'Mangler code eller refresh_token' }, 400);
  }

  try {
    const res = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body: params });
    const data = await res.json();
    if (!res.ok) return json(data, res.status);
    return json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete ? { firstname: data.athlete.firstname, lastname: data.athlete.lastname } : null
    }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
