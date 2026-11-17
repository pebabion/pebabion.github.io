// A small Raft simulation for the playground at /apps/raft/.
//
// It follows the Raft paper (leader election and log copying) with real
// timeouts and message delays, slowed down so people can watch. Time is in
// simulated milliseconds and only moves when advance() is called, so a run
// with a seeded random source is fully repeatable.

export type Role = "follower" | "candidate" | "leader";

export interface Entry {
  term: number;
  value: string;
}

export type Msg =
  | { kind: "vote-req"; term: number; lastIndex: number; lastTerm: number }
  | { kind: "vote"; term: number; granted: boolean }
  | { kind: "append"; term: number; prevIndex: number; prevTerm: number; entries: Entry[]; commit: number }
  // On failure, `match` is a hint: how much of the log the follower might share.
  // `added` is how many items the message carried, so the page can draw acks
  // for items but not for plain pings.
  | { kind: "append-ok"; term: number; success: boolean; match: number; added: number };

// A message on its way. It is lost if the link is cut or the receiver is
// down when it arrives.
export interface Flight {
  id: number;
  from: number;
  to: number;
  sent: number;
  arrive: number;
  msg: Msg;
}

export interface Server {
  id: number;
  name: string;
  alive: boolean;
  role: Role;
  term: number;
  votedFor: number | null;
  leaderId: number | null; // who this server last heard from as leader
  log: Entry[];
  commit: number; // how many log entries are known to be committed
  votes: Set<number>; // candidates only
  timerStart: number; // election timer, for followers and candidates
  timerEnd: number;
  nextBeat: number; // leaders only: when to send the next heartbeat
  beats: number; // heartbeats sent so far, so the page can pulse
  next: number[]; // leaders only: next log index to send each peer
  match: number[]; // leaders only: how much of the log each peer has
  sentAt: number[]; // leaders only: when items last went to each peer
}

export type EventKind = "election" | "leader" | "step-down" | "commit" | "down" | "up" | "link";

export interface RaftEvent {
  id: number;
  at: number;
  kind: EventKind;
  text: string;
}

export interface Timing {
  latency: [number, number];
  heartbeat: number;
  election: [number, number];
  // Timeouts for the very first election, so a fresh cluster gets going sooner.
  firstElection?: [number, number];
}

// Real clusters use ~1 ms messages and ~150–300 ms election timeouts. These
// are slow enough to follow by eye. Messages stay short next to the spread of
// timeouts, so two servers rarely stand at once and ~98% of first elections
// succeed.
export const TIMING: Timing = {
  latency: [1000, 1400],
  heartbeat: 2000,
  election: [4000, 14000],
  firstElection: [1500, 9000], // still ~96% first-time success, ~3 s sooner
};

const MAX_EVENTS = 200;

export class Cluster {
  now = 0;
  servers: Server[];
  flights: Flight[] = [];
  events: RaftEvent[] = [];
  // Every committed entry, in order. It only ever grows.
  committed: Entry[] = [];
  // Who won each term. Raft allows at most one leader per term.
  elections = new Map<number, number>();
  private cut = new Set<string>();
  private seq = 0;

  constructor(
    names: string[],
    private rng: () => number = Math.random,
    private timing: Timing = TIMING,
  ) {
    this.servers = names.map((name, id) => {
      const s: Server = {
        id,
        name,
        alive: true,
        role: "follower",
        term: 0,
        votedFor: null,
        leaderId: null,
        log: [],
        commit: 0,
        votes: new Set(),
        timerStart: 0,
        timerEnd: 0,
        nextBeat: 0,
        beats: 0,
        next: names.map(() => 0),
        match: names.map(() => 0),
        sentAt: names.map(() => -Infinity),
      };
      this.resetTimer(s, this.timing.firstElection);
      return s;
    });
  }

  get majority() {
    return Math.floor(this.servers.length / 2) + 1;
  }

  // The live leader with the newest term. An old leader cut off from the rest
  // may still think it leads; clients should talk to the newest one.
  leader(): Server | undefined {
    let best: Server | undefined;
    for (const s of this.servers) if (s.alive && s.role === "leader" && (!best || s.term > best.term)) best = s;
    return best;
  }

  isCut(a: number, b: number) {
    return this.cut.has(linkKey(a, b));
  }

  toggleLink(a: number, b: number) {
    const key = linkKey(a, b);
    const [x, y] = [this.servers[a].name, this.servers[b].name];
    if (this.cut.delete(key)) this.emit("link", `Fixed the line between ${x} and ${y}`);
    else {
      this.cut.add(key);
      this.emit("link", `Cut the line between ${x} and ${y}`);
    }
  }

  setAlive(id: number, alive: boolean) {
    const s = this.servers[id];
    if (s.alive === alive) return;
    s.alive = alive;
    if (alive) {
      // Term, vote and log survive a restart; everything else starts fresh.
      s.role = "follower";
      s.leaderId = null;
      s.votes.clear();
      this.resetTimer(s);
      this.emit("up", `${s.name} is back`);
    } else {
      this.emit("down", `${s.name} stopped`);
    }
  }

  // Hand a new value to the leader. Returns the leader, or null if there is none.
  propose(value: string): Server | null {
    const l = this.leader();
    if (!l) return null;
    l.log.push({ term: l.term, value });
    l.match[l.id] = l.log.length;
    for (const p of this.peers(l)) this.sendAppend(l, p);
    return l;
  }

  // Run the cluster forward by dt simulated milliseconds, handling every
  // message arrival and timer in time order.
  advance(dt: number) {
    const end = this.now + dt;
    for (let t = this.nextEventTime(); t <= end; t = this.nextEventTime()) {
      this.now = t;
      this.step();
    }
    this.now = end;
  }

  private nextEventTime() {
    let t = Infinity;
    for (const f of this.flights) t = Math.min(t, f.arrive);
    for (const s of this.servers) if (s.alive) t = Math.min(t, s.role === "leader" ? s.nextBeat : s.timerEnd);
    return t;
  }

  private step() {
    const due = this.flights.filter((f) => f.arrive <= this.now).sort((a, b) => a.arrive - b.arrive || a.id - b.id);
    if (due.length) {
      this.flights = this.flights.filter((f) => f.arrive > this.now);
      for (const f of due) this.deliver(f);
    }
    for (const s of this.servers) {
      if (!s.alive) continue;
      if (s.role === "leader") {
        if (s.nextBeat <= this.now) this.heartbeat(s);
      } else if (s.timerEnd <= this.now) {
        this.startElection(s);
      }
    }
  }

  private deliver(f: Flight) {
    const s = this.servers[f.to];
    if (!s.alive || this.isCut(f.from, f.to)) return;
    const m = f.msg;
    if (m.term > s.term) this.stepDown(s, m.term);

    switch (m.kind) {
      case "vote-req": {
        const lastTerm = s.log.at(-1)?.term ?? 0;
        const upToDate = m.lastTerm > lastTerm || (m.lastTerm === lastTerm && m.lastIndex >= s.log.length);
        const granted = m.term === s.term && (s.votedFor === null || s.votedFor === f.from) && upToDate;
        if (granted) {
          s.votedFor = f.from;
          this.resetTimer(s);
        }
        this.send(s, f.from, { kind: "vote", term: s.term, granted });
        break;
      }
      case "vote": {
        if (s.role !== "candidate" || m.term !== s.term || !m.granted) break;
        s.votes.add(f.from);
        if (s.votes.size >= this.majority) this.becomeLeader(s);
        break;
      }
      case "append": {
        if (m.term < s.term) {
          this.send(s, f.from, { kind: "append-ok", term: s.term, success: false, match: 0, added: 0 });
          break;
        }
        // A leader exists for this term, so stop campaigning and follow it.
        if (s.role === "candidate") s.role = "follower";
        s.leaderId = f.from;
        this.resetTimer(s);
        const fits = m.prevIndex <= s.log.length && (m.prevIndex === 0 || s.log[m.prevIndex - 1].term === m.prevTerm);
        if (!fits) {
          const hint = Math.min(s.log.length, m.prevIndex - 1);
          this.send(s, f.from, { kind: "append-ok", term: s.term, success: false, match: hint, added: 0 });
          break;
        }
        m.entries.forEach((e, i) => {
          const idx = m.prevIndex + i;
          // Drop anything that conflicts with the leader, then copy what is missing.
          if (idx < s.log.length && s.log[idx].term !== e.term) s.log.length = idx;
          if (idx >= s.log.length) s.log.push({ ...e });
        });
        const match = m.prevIndex + m.entries.length;
        s.commit = Math.max(s.commit, Math.min(m.commit, match));
        this.send(s, f.from, { kind: "append-ok", term: s.term, success: true, match, added: m.entries.length });
        break;
      }
      case "append-ok": {
        if (s.role !== "leader" || m.term !== s.term) break;
        if (m.success) {
          s.match[f.from] = Math.max(s.match[f.from], m.match);
          s.next[f.from] = s.match[f.from];
          this.advanceCommit(s);
        } else {
          // Back up and try again from an earlier point in the log.
          s.next[f.from] = Math.max(0, Math.min(s.next[f.from] - 1, m.match));
          this.sendAppend(s, f.from);
        }
        break;
      }
    }
  }

  private startElection(s: Server) {
    s.term += 1;
    s.role = "candidate";
    s.votedFor = s.id;
    s.leaderId = null;
    s.votes = new Set([s.id]);
    this.resetTimer(s);
    this.emit("election", `${s.name} ran out of patience and asks for votes`);
    const lastIndex = s.log.length;
    const lastTerm = s.log.at(-1)?.term ?? 0;
    for (const p of this.peers(s)) this.send(s, p, { kind: "vote-req", term: s.term, lastIndex, lastTerm });
  }

  private becomeLeader(s: Server) {
    s.role = "leader";
    s.leaderId = s.id;
    s.next = this.servers.map(() => s.log.length);
    s.match = this.servers.map(() => 0);
    s.sentAt = this.servers.map(() => -Infinity);
    s.match[s.id] = s.log.length;
    this.elections.set(s.term, s.id);
    this.emit("leader", `${s.name} won ${s.votes.size} of ${this.servers.length} votes and is the leader`);
    this.heartbeat(s);
  }

  private stepDown(s: Server, term: number) {
    const was = s.role;
    s.term = term;
    s.votedFor = null;
    s.leaderId = null;
    if (was === "follower") return;
    s.role = "follower";
    this.resetTimer(s);
    if (was === "leader") this.emit("step-down", `${s.name} hears of a newer vote and stops leading`);
  }

  // Items sent less than a round trip ago may still be on their way, or their
  // "got it" may be. Ping without them until the answer has had time to come
  // back; after that, send them again in case they were lost.
  private heartbeat(s: Server) {
    const roundTrip = 2 * this.timing.latency[1];
    for (const p of this.peers(s)) this.sendAppend(s, p, this.now - s.sentAt[p] >= roundTrip);
    s.nextBeat = this.now + this.timing.heartbeat;
    s.beats += 1;
  }

  private sendAppend(s: Server, to: number, withItems = true) {
    const prevIndex = s.next[to];
    const entries = withItems ? s.log.slice(prevIndex).map((e) => ({ ...e })) : [];
    if (entries.length) s.sentAt[to] = this.now;
    this.send(s, to, {
      kind: "append",
      term: s.term,
      prevIndex,
      prevTerm: prevIndex ? s.log[prevIndex - 1].term : 0,
      entries,
      commit: s.commit,
    });
  }

  // An entry is committed once most servers have it. Raft only counts entries
  // from the leader's own term; older ones commit along with them.
  private advanceCommit(s: Server) {
    for (let n = s.log.length; n > s.commit; n--) {
      if (s.log[n - 1].term !== s.term) break;
      const have = s.match.filter((m) => m >= n).length;
      if (have < this.majority) continue;
      for (let i = s.commit; i < n; i++) {
        if (i < this.committed.length) continue; // an earlier leader already committed it
        this.committed.push({ ...s.log[i] });
        this.emit("commit", `${s.log[i].value} is saved: ${this.majority} of ${this.servers.length} have it`);
      }
      s.commit = n;
      break;
    }
  }

  private send(from: Server, to: number, msg: Msg) {
    const [lo, hi] = this.timing.latency;
    this.flights.push({ id: this.seq++, from: from.id, to, sent: this.now, arrive: this.now + lo + this.rng() * (hi - lo), msg });
  }

  private resetTimer(s: Server, range = this.timing.election) {
    const [lo, hi] = range;
    s.timerStart = this.now;
    s.timerEnd = this.now + lo + this.rng() * (hi - lo);
  }

  private peers(s: Server) {
    return this.servers.filter((p) => p.id !== s.id).map((p) => p.id);
  }

  private emit(kind: EventKind, text: string) {
    this.events.push({ id: this.seq++, at: this.now, kind, text });
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }
}

export function linkKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
