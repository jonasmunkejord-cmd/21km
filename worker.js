// worker.js
// Én Worker som serverer de statiske filene (index.html, manifest, ikoner)
// OG håndterer /strava-auth-endepunktet server-side, slik at Client Secret
// aldri havner i nettleseren.

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

async function handleStravaAuth(request, env) {
  const clientId = env.STRAVA_CLIENT_ID;
  const clientSecret = env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET mangler som secrets på Worker-en.' }, 500);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/strava-auth') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
      if (request.method === 'POST') return handleStravaAuth(request, env);
      return json({ error: 'Method not allowed' }, 405);
    }

    // Alt annet: server de statiske filene (index.html, manifest.json, ikoner osv.)
    return env.ASSETS.fetch(request);
  }
};
