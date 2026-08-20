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
const CODE_RE = /^[A-Z0-9]{4,12}$/;

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
        // Default to the published app rather than '*': if the dashboard variable
        // is ever cleared, the worker must fail closed, not open to every site.
        const allowed = (env.ALLOWED_ORIGINS || 'https://mohamadabbasico-ai.github.io')
            .split(',').map(s => s.trim()).filter(Boolean);
        const origin = request.headers.get('Origin') || '';
        const ch = cors(origin, allowed);

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);

        if (parts[0] === 'health') return json({ ok: true }, 200, ch);

        /* Short trip code -> sync id.
         *
         * The 6-character code is the thing people can read out loud or type
         * on a phone, but it only ever looked in local storage, so a trip made
         * on a laptop was unreachable from a phone without shipping a JSON
         * file around. This maps the code to the long sync id.
         *
         * The code is short enough to enumerate, so resolving one deliberately
         * returns nothing but the sync id and the trip name. Reading the trip
         * still needs the 22-character id, and joining still puts the newcomer
         * through the identity step.
         */
        if (parts[0] === 'code' && parts[1]) {
            const code = String(parts[1]).toUpperCase();
            if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400, ch);
            const ckey = 'code:' + code;

            if (request.method === 'GET') {
                const rec = await env.TRIPS.get(ckey, { type: 'json' });
                if (!rec || !rec.syncId) return json({ error: 'not_found' }, 404, ch);
                return json({ syncId: rec.syncId, name: rec.name || '' }, 200, ch);
            }
            if (request.method === 'PUT') {
                const raw = await request.text();
                if (raw.length > 4096) return json({ error: 'too_large' }, 413, ch);
                let body;
                try { body = JSON.parse(raw); } catch (e) { return json({ error: 'bad_json' }, 400, ch); }
                if (!body || !ID_RE.test(String(body.syncId || ''))) {
                    return json({ error: 'bad_shape' }, 400, ch);
                }
                const existing = await env.TRIPS.get(ckey, { type: 'json' });
                // First registration wins, so a stranger cannot repoint someone
                // else's code at a trip they control.
                if (existing && existing.syncId && existing.syncId !== body.syncId) {
                    return json({ error: 'code_taken' }, 409, ch);
                }
                await env.TRIPS.put(ckey, JSON.stringify({
                    syncId: body.syncId,
                    name: String(body.name || '').slice(0, 80)
                }), { expirationTtl: 60 * 60 * 24 * 90 });
                return json({ ok: true }, 200, ch);
            }
            return json({ error: 'method_not_allowed' }, 405, ch);
        }

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
