/**
 * Safarino sync worker.
 *
 * Deliberately tiny: the app stays offline-first and authoritative on the
 * device. This is a shared mailbox, not a database. It stores one JSON blob
 * per trip and hands it back to whoever holds the trip's sync id.
 *
 * Access model: possession of the sync id grants read and write, the same way
 * a Tricount or Kittysplit link does. The id is 22 url-safe characters
 * (~131 bits), not the 6-character human code, precisely so it cannot be
 * guessed or enumerated.
 */

const MAX_BODY = 512 * 1024;         // a trip with photos stripped is a few KB
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function cors(origin, allowed) {
    const ok = allowed.includes(origin) ? origin : allowed[0];
    return {
        'Access-Control-Allow-Origin': ok,
        'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,If-Match',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function json(body, status, headers) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {})
    });
}

export default {
    async fetch(request, env) {
        const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
        const origin = request.headers.get('Origin') || '';
        const ch = cors(origin, allowed);

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);

        if (parts[0] === 'health') return json({ ok: true }, 200, ch);

        if (parts[0] !== 'trip' || !parts[1]) {
            return json({ error: 'not_found' }, 404, ch);
        }
        const id = parts[1];
        if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400, ch);

        const key = 'trip:' + id;

        if (request.method === 'GET') {
            const stored = await env.TRIPS.get(key, { type: 'json' });
            if (!stored) return json({ error: 'not_found' }, 404, ch);
            return json(stored, 200, Object.assign({ ETag: '"' + stored.rev + '"' }, ch));
        }

        if (request.method === 'PUT') {
            const raw = await request.text();
            if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413, ch);

            let incoming;
            try { incoming = JSON.parse(raw); }
            catch (e) { return json({ error: 'bad_json' }, 400, ch); }
            if (!incoming || typeof incoming !== 'object' || !incoming.trip) {
                return json({ error: 'bad_shape' }, 400, ch);
            }

            const current = await env.TRIPS.get(key, { type: 'json' });
            const rev = (current && current.rev ? current.rev : 0) + 1;
            const record = {
                rev: rev,
                updatedAt: Date.now(),
                trip: incoming.trip
            };
            // 90 days of inactivity is plenty for a trip; keeps free tier tidy.
            await env.TRIPS.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 90 });
            return json({ rev: rev, updatedAt: record.updatedAt }, 200, ch);
        }

        return json({ error: 'method_not_allowed' }, 405, ch);
    }
};
