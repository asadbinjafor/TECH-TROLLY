type PageEntry = { session: string; path: string; previous: boolean };
type Entry = { page: PageEntry; layers: string[] };
type Layer = { close: () => void; modal: boolean };
export interface HistoryPort {
  path(): string;
  read(): Record<string, unknown>;
  write(entry: Entry, push: boolean): void;
  go(delta: number): void;
  route(path: string, replace: boolean): void;
}

/** Keep transient UI entries separate from financial drafts and Next's state. */
export class NavigationHistory {
  private session = "";
  private page: PageEntry | null = null;
  private stack: string[] = [];
  private layers = new Map<string, Layer>();
  private destination: string | null = null;
  private waiting = false;
  constructor(
    private port: HistoryPort,
    private changed: () => void,
  ) {}

  get busy() {
    return this.waiting;
  }
  get hasLayers() {
    return this.layers.size > 0;
  }
  get modalOpen() {
    return [...this.layers.values()].some((l) => l.modal);
  }
  canBack(path: string) {
    return (
      this.layers.size > 0 ||
      (path !== "/" && path !== "/overview") ||
      !!this.page?.previous
    );
  }
  initialize(session: string, path: string) {
    const first = !this.session;
    this.session = session;
    if (first) this.stack = this.entry()?.layers || [];
    this.adoptPage(path);
  }
  adoptPage(path: string) {
    if (!this.session || this.waiting) return;
    const saved = this.entry();
    if (saved?.page.path === path) {
      this.page = saved.page;
    } else {
      this.page = {
        session: this.session,
        path,
        previous: !!this.page && this.page.path !== path,
      };
    }
    // Reconcile consumes stale transient entries after a reload.
    this.port.write({ page: this.page, layers: this.stack }, false);
    this.changed();
    this.reconcile();
  }
  private entry(): Entry | null {
    const e = this.port.read().ttNavigation as Entry | undefined;
    return e?.page?.session === this.session &&
      typeof e.page.path === "string" &&
      Array.isArray(e.layers)
      ? e
      : null;
  }
  register(id: string, close: () => void, modal: boolean) {
    if (this.page && this.page.path !== this.port.path() && !this.waiting)
      this.adoptPage(this.port.path());
    this.layers.set(id, { close, modal });
    this.changed();
    this.reconcile();
    return () => {
      this.layers.delete(id);
      this.changed();
      this.reconcile();
    };
  }
  back() {
    if (this.waiting) return;
    if (this.page && this.page.path !== this.port.path())
      this.adoptPage(this.port.path());
    const top = [...this.layers.keys()].at(-1);
    if (top) {
      const layer = this.layers.get(top)!;
      this.layers.delete(top);
      layer.close();
      this.changed();
      this.reconcile();
    } else if (this.page?.previous) {
      this.waiting = true;
      this.changed();
      this.port.go(-1);
    } else if (this.page?.path !== "/") {
      this.page = null;
      this.port.route("/", true);
    }
  }
  navigate(path: string) {
    this.destination = path;
    const close = [...this.layers.values()].reverse();
    this.layers.clear();
    close.forEach((l) => l.close());
    this.changed();
    this.reconcile();
  }
  pop() {
    const stored = this.entry();
    const target = stored && {
      ...stored,
      page: { ...stored.page, path: this.port.path() },
    };
    const next = target?.layers || [];
    let livePrefix = 0;
    while (livePrefix < next.length && this.layers.has(next[livePrefix]))
      livePrefix++;
    // Forward must not resurrect a dismissed dialog or leave a dead Back stop.
    if (livePrefix < next.length) {
      this.waiting = true;
      this.changed();
      this.port.go(livePrefix - next.length);
      return;
    }
    const pageChanged = target?.page.path !== this.page?.path;
    const closing = pageChanged
      ? [...this.layers.keys()]
      : this.stack.filter((id) => !next.includes(id));
    const callbacks = closing.map((id) => this.layers.get(id)?.close);
    closing.forEach((id) => this.layers.delete(id));
    this.page = target?.page || null;
    this.stack = next.filter((id) => this.layers.has(id));
    this.waiting = false;
    callbacks.reverse().forEach((close) => close?.());
    if (
      target &&
      (this.stack.length !== next.length ||
        stored?.page.path !== target.page.path)
    )
      this.port.write({ page: target.page, layers: this.stack }, false);
    this.changed();
    this.reconcile();
  }
  private reconcile() {
    if (!this.page || this.waiting) return;
    const desired = [...this.layers.keys()];
    let common = 0;
    while (common < this.stack.length && this.stack[common] === desired[common])
      common++;
    if (common < this.stack.length) {
      this.waiting = true;
      this.changed();
      this.port.go(common - this.stack.length);
      return;
    }
    if (this.destination !== null) {
      const path = this.destination;
      this.destination = null;
      if (path !== this.page.path) this.port.route(path, false);
      return;
    }
    for (const id of desired.slice(common)) {
      this.stack.push(id);
      this.port.write({ page: this.page, layers: [...this.stack] }, true);
    }
  }
}
