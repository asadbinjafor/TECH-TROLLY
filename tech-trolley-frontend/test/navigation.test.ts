import test from "node:test";
import assert from "node:assert/strict";
import {
  NavigationHistory,
  type HistoryPort,
} from "../src/components/navigation/navigation-history";

function browser(path = "/") {
  let index = 0,
    target: number | null = null;
  const entries: { path: string; state: Record<string, unknown> }[] = [
    { path, state: { __NA: true, tree: "next-owned" } },
  ];
  const routes: { path: string; replace: boolean }[] = [];
  const port: HistoryPort = {
    path: () => entries[index].path,
    read: () => entries[index].state,
    write: (entry, push) => {
      const next = {
        path: entries[index].path,
        state: {
          ...entries[index].state,
          ttNavigation: structuredClone(entry),
        },
      };
      if (push) {
        entries.splice(++index);
        entries.push(next);
      } else entries[index] = next;
    },
    go: (delta) => {
      assert.equal(target, null, "history moves must be serialized");
      target = index + delta;
      assert.ok(target >= 0);
    },
    route: (path, replace) => {
      routes.push({ path, replace });
      const next = { path, state: { __NA: true, tree: "next-owned" } };
      if (replace) entries[index] = next;
      else {
        entries.splice(++index);
        entries.push(next);
      }
      history.adoptPage(path);
    },
  };
  const history = new NavigationHistory(port, () => {});
  history.initialize("test-tab", path);
  return {
    history,
    entries,
    routes,
    port,
    current: () => entries[index],
    unadopted: (path: string) => {
      const next = { path, state: structuredClone(entries[index].state) };
      entries.splice(++index);
      entries.push(next);
    },
    flush: (owner = history) => {
      assert.notEqual(target, null);
      index = target!;
      target = null;
      owner.pop();
    },
    pop: () => {
      target = index - 1;
    },
    forward: () => {
      target = index + 1;
    },
  };
}
test("page Back uses same-tab history; a direct deep link replaces with Dashboard", () => {
  const b = browser();
  b.history.navigate("/inventory");
  assert.equal(b.entries.length, 2);
  b.history.back();
  assert.equal(b.history.busy, true);
  b.flush();
  assert.equal(b.current().path, "/");
  assert.equal(b.history.canBack("/"), false);
  const direct = browser("/purchases");
  direct.history.back();
  assert.deepEqual(direct.routes, [{ path: "/", replace: true }]);
  assert.equal(direct.entries.length, 1);
  assert.equal(direct.history.canBack("/"), false);
});
test("browser Back and Escape close only the top nested layer without changing Next state", () => {
  const b = browser();
  let outer = 0,
    inner = 0;
  b.history.register("form", () => outer++, true);
  b.history.register("names", () => inner++, true);
  b.pop();
  b.flush();
  assert.equal(inner, 1);
  assert.equal(outer, 0);
  assert.equal(b.history.modalOpen, true);
  b.history.back();
  b.flush();
  assert.equal(outer, 1);
  assert.equal(b.history.modalOpen, false);
  assert.equal(b.current().state.tree, "next-owned");
  assert.equal(b.current().path, "/");
});
test("manual close consumes history before a replacement receipt layer is pushed", () => {
  const b = browser();
  const close = b.history.register("form", () => {}, true);
  close();
  b.history.register("receipt", () => {}, true);
  assert.equal(b.history.busy, true);
  b.flush();
  assert.deepEqual((b.current().state.ttNavigation as any).layers, ["receipt"]);
  assert.equal(b.entries.length, 2);
  b.history.back();
  b.flush();
  assert.deepEqual((b.current().state.ttNavigation as any).layers, []);
});
test("menu navigation waits for dismissal and does not leave a duplicate page entry", () => {
  const b = browser();
  let closed = 0;
  const dispose = b.history.register("menu", () => closed++, true);
  b.history.navigate("/sale");
  dispose();
  assert.equal(b.routes.length, 0);
  b.flush();
  assert.equal(closed, 1);
  assert.equal(b.current().path, "/sale");
  assert.equal(b.entries.length, 2);
  b.history.back();
  b.flush();
  assert.equal(b.current().path, "/");
});
test("reload consumes unowned transient entries rather than reopening private dialogs", () => {
  const b = browser();
  b.history.navigate("/inventory");
  b.history.register("form", () => {}, true);
  b.history.register("review", () => {}, false);
  const reloaded = new NavigationHistory(b.port, () => {});
  reloaded.initialize("test-tab", "/inventory");
  assert.equal(reloaded.busy, true);
  // Two transient entries are consumed in one move; the remaining entry is the inventory page.
  b.flush(reloaded);
  assert.equal(b.current().path, "/inventory");
  assert.equal((b.current().state.ttNavigation as any).layers.length, 0);
});
test("effect replay consumes the disposed entry without closing its new lifetime", () => {
  const b = browser();
  let closed = 0;
  const dispose = b.history.register("first-lifetime", () => closed++, true);
  dispose();
  b.history.register("second-lifetime", () => closed++, true);
  b.flush();
  assert.equal(closed, 0);
  assert.equal(b.history.modalOpen, true);
  assert.deepEqual((b.current().state.ttNavigation as any).layers, [
    "second-lifetime",
  ]);
});
test("a menu opened immediately after a route keeps the new page as its return destination", () => {
  const b = browser();
  b.unadopted("/inventory");
  b.history.register("menu", () => {}, true);
  b.history.back();
  b.flush();
  assert.equal(b.current().path, "/inventory");
  assert.equal((b.current().state.ttNavigation as any).page.path, "/inventory");
  b.history.back();
  b.flush();
  assert.equal(b.current().path, "/");
});
test("Forward to a dismissed dialog returns to its page without a dead Back entry", () => {
  const b = browser();
  b.history.navigate("/inventory");
  b.history.register("dialog", () => {}, true);
  b.pop();
  b.flush();
  b.forward();
  b.flush();
  assert.equal(b.history.busy, true);
  b.flush();
  assert.equal(b.history.modalOpen, false);
  assert.equal(b.current().path, "/inventory");
  b.history.back();
  b.flush();
  assert.equal(b.current().path, "/");
});
