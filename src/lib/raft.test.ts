import { describe, expect, it } from "vitest";
import { Cluster, type Entry, TIMING, linkKey } from "./raft";

const NAMES = ["Ada", "Bea", "Cal", "Dot", "Eli"];

// Small seeded random source so every run is the same.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Waits are in terms of the timings, so retuning them doesn't break tests.
// ROUND: long enough for a heartbeat to go out and its reply to come back.
// LONG: many election timeouts.
const ROUND = TIMING.heartbeat + 2 * TIMING.latency[1];
const LONG = 10 * TIMING.election[1];

const cluster = (seed = 1) => new Cluster(NAMES, seeded(seed));
const leaders = (c: Cluster) => c.servers.filter((s) => s.alive && s.role === "leader");
const same = (a: Entry[], b: Entry[]) => a.length === b.length && a.every((e, i) => e.term === b[i].term && e.value === b[i].value);

// Run until there is exactly one leader whose term is newest, or fail.
function settle(c: Cluster, limit = LONG) {
  const end = c.now + limit;
  while (c.now < end) {
    c.advance(100);
    const ls = leaders(c);
    const top = Math.max(...c.servers.filter((s) => s.alive).map((s) => s.term));
    if (ls.length === 1 && ls[0].term === top) return ls[0];
  }
  throw new Error("no leader");
}

function cutOff(c: Cluster, id: number) {
  for (const s of c.servers) if (s.id !== id) c.toggleLink(id, s.id);
}

describe("leader election", () => {
  it.each([1, 2, 3, 4, 5])("elects one leader (seed %d)", (seed) => {
    const c = cluster(seed);
    const l = settle(c);
    expect(leaders(c)).toHaveLength(1);
    expect(l.term).toBeGreaterThanOrEqual(1);
    expect(c.events.some((e) => e.kind === "leader")).toBe(true);
  });

  it("followers know who the leader is", () => {
    const c = cluster();
    const l = settle(c);
    c.advance(ROUND);
    for (const s of c.servers) expect(s.leaderId).toBe(l.id);
  });

  it("starts the first election sooner", () => {
    const c = cluster();
    const [, hi] = TIMING.firstElection!;
    for (const s of c.servers) expect(s.timerEnd).toBeLessThanOrEqual(hi);
  });

  it("keeps the same leader while nothing goes wrong", () => {
    const c = cluster();
    const l = settle(c);
    c.advance(LONG);
    expect(leaders(c).map((s) => s.id)).toEqual([l.id]);
    expect(c.servers.every((s) => s.term === l.term)).toBe(true);
  });

  it("elects a new leader in a later term when the leader stops", () => {
    const c = cluster();
    const old = settle(c);
    c.setAlive(old.id, false);
    const l = settle(c);
    expect(l.id).not.toBe(old.id);
    expect(l.term).toBeGreaterThan(old.term);
  });

  it("a server cut off from the rest never wins, but the rest carry on", () => {
    const c = cluster();
    const l = settle(c);
    const lonely = (l.id + 1) % NAMES.length;
    cutOff(c, lonely);
    c.advance(LONG);
    const s = c.servers[lonely];
    expect(s.role).not.toBe("leader");
    expect(s.term).toBeGreaterThan(l.term); // it keeps calling elections
    expect(leaders(c).map((x) => x.id)).toEqual([l.id]);
  });

  it("no leader can win with only two of five servers up", () => {
    const c = cluster();
    settle(c);
    for (const id of [0, 1, 2]) c.setAlive(id, false);
    c.advance(LONG);
    expect(leaders(c)).toHaveLength(0);
  });
});

describe("log copying", () => {
  it("copies a value to every server and commits it", () => {
    const c = cluster();
    settle(c);
    expect(c.propose("🍩")).not.toBeNull();
    c.advance(2 * ROUND);
    for (const s of c.servers) {
      expect(s.log.map((e) => e.value)).toEqual(["🍩"]);
      expect(s.commit).toBe(1);
    }
    expect(c.committed.map((e) => e.value)).toEqual(["🍩"]);
  });

  it("sends a new item once to each follower when nothing goes wrong", () => {
    const c = cluster();
    settle(c);
    c.advance(ROUND);
    c.propose("🍩");
    const seen = new Set<number>();
    for (let t = 0; t < 3 * ROUND; t += 20) {
      for (const f of c.flights) if (f.msg.kind === "append" && f.msg.entries.length) seen.add(f.id);
      c.advance(20);
    }
    expect(seen.size).toBe(NAMES.length - 1);
    for (const s of c.servers) expect(s.commit).toBe(1);
  });

  it("acks say how many items they answer", () => {
    const c = cluster();
    settle(c);
    c.advance(ROUND);
    c.propose("🍩");
    const acks: number[] = [];
    for (let t = 0; t < 2 * ROUND; t += 20) {
      for (const f of c.flights) if (f.msg.kind === "append-ok" && f.msg.success && f.msg.added) acks.push(f.id);
      c.advance(20);
    }
    expect(new Set(acks).size).toBe(NAMES.length - 1);
  });

  it("keeps resending to a server that is down", () => {
    const c = cluster();
    const l = settle(c);
    const sleeper = (l.id + 1) % NAMES.length;
    c.setAlive(sleeper, false);
    c.propose("🍩");
    const sends = new Set<number>();
    for (let t = 0; t < 4 * ROUND; t += 20) {
      for (const f of c.flights) if (f.to === sleeper && f.msg.kind === "append" && f.msg.entries.length) sends.add(f.id);
      c.advance(20);
    }
    expect(sends.size).toBeGreaterThan(2);
  });

  it("has nowhere to send a value without a leader", () => {
    expect(cluster().propose("x")).toBeNull();
  });

  it("still commits with two servers down", () => {
    const c = cluster();
    const l = settle(c);
    const others = c.servers.filter((s) => s.id !== l.id).slice(0, 2);
    for (const s of others) c.setAlive(s.id, false);
    c.propose("a");
    c.advance(2 * ROUND);
    expect(l.commit).toBe(1);
  });

  it("an old leader cut off with one follower cannot commit", () => {
    const c = cluster();
    const old = settle(c);
    const buddy = (old.id + 1) % NAMES.length;
    // Split into {old, buddy} and the other three.
    for (const a of [old.id, buddy]) for (const s of c.servers) if (s.id !== old.id && s.id !== buddy) c.toggleLink(a, s.id);
    c.propose("lost");
    const fresh = c.servers.find((s) => s.id !== old.id && s.id !== buddy)!;
    c.advance(LONG / 2);
    expect(old.commit).toBe(0);
    expect(c.committed).toHaveLength(0);

    // The bigger side elects its own leader, who can commit.
    const l = c.leader()!;
    expect(l.id).not.toBe(old.id);
    expect(l.term).toBeGreaterThan(old.term);
    c.propose("kept");
    c.advance(2 * ROUND);
    expect(c.committed.map((e) => e.value)).toEqual(["kept"]);
    expect(fresh.log.map((e) => e.value)).toEqual(["kept"]);

    // Once healed, the old leader steps down and its stray entry is replaced.
    for (const a of [old.id, buddy]) for (const s of c.servers) if (s.id !== old.id && s.id !== buddy) c.toggleLink(a, s.id);
    c.advance(3 * ROUND);
    expect(old.role).toBe("follower");
    expect(old.log.map((e) => e.value)).toEqual(["kept"]);
  });

  it("a restarted server catches up", () => {
    const c = cluster();
    const l = settle(c);
    const sleeper = (l.id + 2) % NAMES.length;
    c.setAlive(sleeper, false);
    for (const v of ["a", "b", "c"]) c.propose(v);
    c.advance(2 * ROUND);
    expect(c.servers[sleeper].log).toHaveLength(0);
    c.setAlive(sleeper, true);
    c.advance(2 * ROUND);
    expect(c.servers[sleeper].log.map((e) => e.value)).toEqual(["a", "b", "c"]);
    expect(c.servers[sleeper].commit).toBe(3);
  });

  it("toggling a link twice mends it", () => {
    const c = cluster();
    c.toggleLink(1, 3);
    expect(c.isCut(3, 1)).toBe(true);
    c.toggleLink(3, 1);
    expect(c.isCut(1, 3)).toBe(false);
    expect(linkKey(3, 1)).toBe("1-3");
  });
});

// Throw random trouble at the cluster and check Raft's safety rules hold the
// whole time, then heal everything and check it all comes back together.
describe("chaos", () => {
  it.each([7, 42, 1234])("stays safe (seed %d)", (seed) => {
    const rng = seeded(seed * 31);
    const c = cluster(seed);
    let committed: Entry[] = [];
    const ledBy = new Map<number, number>();
    let n = 0;

    for (let t = 0; t < 300_000; t += 100) {
      if (t % 1000 === 0) {
        const r = rng();
        const id = Math.floor(rng() * NAMES.length);
        const other = (id + 1 + Math.floor(rng() * (NAMES.length - 1))) % NAMES.length;
        if (r < 0.1) c.setAlive(id, !c.servers[id].alive);
        else if (r < 0.2) c.toggleLink(id, other);
        else if (r < 0.6) c.propose(`v${n++}`);
      }
      c.advance(100);

      // At most one leader per term. A leader lasts longer than one step, so
      // checking every step catches them all.
      for (const s of leaders(c)) {
        expect(ledBy.get(s.term) ?? s.id).toBe(s.id);
        ledBy.set(s.term, s.id);
      }
      // Committed entries are never lost or changed.
      expect(same(c.committed.slice(0, committed.length), committed)).toBe(true);
      committed = c.committed.map((e) => ({ ...e }));
      // Every server's committed part matches the committed history.
      for (const s of c.servers) expect(same(s.log.slice(0, s.commit), c.committed.slice(0, s.commit))).toBe(true);
    }

    // Heal everything.
    for (const s of c.servers) c.setAlive(s.id, true);
    for (let a = 0; a < NAMES.length; a++) for (let b = a + 1; b < NAMES.length; b++) if (c.isCut(a, b)) c.toggleLink(a, b);
    const l = settle(c);
    c.propose("last");
    c.advance(3 * ROUND);
    for (const s of c.servers) {
      expect(same(s.log, l.log)).toBe(true);
      expect(s.commit).toBe(l.log.length);
    }
    expect(committed.length).toBeGreaterThan(0);
  });
});
