
    // ========== SYNC: MERGE ==========
    // Record-level merge, not whole-trip replacement. If two phones both push
    // a trip, replacing wholesale silently destroys whatever the loser added.
    // Every record carries updatedAt; the newer edit wins per record, and
    // deletions are kept as tombstones so a delete is not resurrected by a
    // stale peer that never saw it.
    function stamp(rec) {
        if (!rec.updatedAt) rec.updatedAt = Date.now();
        return rec;
    }

    function mergeLists(mine, theirs, tombMine, tombTheirs) {
        const out = new Map();
        const dead = new Map();
        (tombMine || []).concat(tombTheirs || []).forEach(t => {
            const prev = dead.get(t.id) || 0;
            if (t.at > prev) dead.set(t.id, t.at);
        });
        const consider = (rec) => {
            if (!rec || !rec.id) return;
            const killedAt = dead.get(rec.id);
            const mod = rec.updatedAt || rec.createdAt || 0;
            if (killedAt && killedAt >= mod) return;      // deletion is newer, stay deleted
            const existing = out.get(rec.id);
            if (!existing || (rec.updatedAt || 0) > (existing.updatedAt || 0)) out.set(rec.id, rec);
        };
        (mine || []).forEach(consider);
        (theirs || []).forEach(consider);
        return { list: [...out.values()], tombstones: [...dead.entries()].map(([id, at]) => ({ id, at })) };
    }

    function mergeTrips(local, remote) {
        if (!remote) return local;
        if (!local) return remote;

        const ex = mergeLists(local.expenses, remote.expenses, local.tombExpenses, remote.tombExpenses);
        const pm = mergeLists(local.payments, remote.payments, local.tombPayments, remote.tombPayments);
        const mb = mergeLists(local.members, remote.members, local.tombMembers, remote.tombMembers);

        // Scalar trip fields: last writer wins, compared on the trip's own stamp.
        const newer = (remote.lastModified || 0) > (local.lastModified || 0) ? remote : local;

        return Object.assign({}, local, {
            name: newer.name,
            date: newer.date,
            currency: newer.currency,
            adminId: newer.adminId,
            rates: Object.assign({}, remote.rates || {}, local.rates || {}),
            members: mb.list,
            expenses: ex.list.sort((a, b) => (a.spentAt || a.createdAt || 0) - (b.spentAt || b.createdAt || 0)),
            payments: pm.list,
            tombMembers: mb.tombstones,
            tombExpenses: ex.tombstones,
            tombPayments: pm.tombstones,
            lastModified: Math.max(local.lastModified || 0, remote.lastModified || 0)
        });
    }
