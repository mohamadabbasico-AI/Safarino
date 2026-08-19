# Safarino sync worker

A shared mailbox for trips, not a database. The app stays offline-first and
authoritative on the device; this only stores one JSON blob per trip.

## Live

Deployed at `https://safarino-sync.m-abbasi0812.workers.dev`
KV namespace `safarino-trips` (`f9c3444299f841cf9f19cc716c180b73`) bound as `TRIPS`.

## Deploy

```
npm install -g wrangler
wrangler login
wrangler kv namespace create TRIPS      # copy the id into wrangler.toml
wrangler deploy
```

## API

| method | path | purpose |
|---|---|---|
| GET  | `/trip/:syncId` | fetch the stored trip (404 if none) |
| PUT  | `/trip/:syncId` | store the trip, returns the new `rev` |
| GET  | `/health` | liveness |

## Access model

Possession of the sync id grants read and write, the same way a Tricount or
Kittysplit link does. The id is 22 url-safe characters (~131 bits) rather than
the 6-character human trip code, so it cannot be guessed or enumerated. The
short code stays a local convenience only.

## Conflict handling

Whole-trip replacement loses data whenever two phones both push, so merging
happens per record: every expense, payment and member carries `updatedAt` and
the newer edit wins. Deletions leave tombstones so a stale peer cannot
resurrect them, while an edit made *after* a deletion does win. See
`test/merge.test.js` - 400 randomised concurrent-edit pairs are checked to
converge to the same result regardless of merge direction.

## Free tier

100,000 reads/day and 1,000 writes/day on Workers KV. A trip blob is a few KB.
Entries expire after 90 days of inactivity.
