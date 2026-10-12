import { findByProps, findByStoreName } from "@vendetta/metro";
import { React, FluxDispatcher } from "@vendetta/metro/common";
import { before, unpatchAll } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Name-independent approach: we don't know what Discord calls the status bubble
// component, so instead we track every custom status text Discord has in its
// presence data and make any <Text> that renders exactly one of them selectable.

const PresenceStore: any = findByStoreName("PresenceStore");
let statuses = new Set<string>();

function collect(acts: any, into: Set<string>) {
  if (!Array.isArray(acts)) return;
  for (const a of acts) {
    // activity type 4 = custom status; its text lives in `state`
    if (a?.type === 4 && typeof a.state === "string" && a.state.trim()) {
      into.add(a.state.trim());
    }
  }
}

function scan() {
  try {
    if (!PresenceStore) return;
    const next = new Set<string>();
    const ids: string[] =
      PresenceStore.getUserIds?.() ??
      Object.keys(PresenceStore.getState?.()?.activities ?? {});
    for (const id of ids) collect(PresenceStore.getActivities?.(id), next);
    statuses = next;
  } catch (e) {
    console.error("[CopyStatus] scan failed", e);
  }
}

function isStatusText(children: any): boolean {
  if (statuses.size === 0) return false;
  if (typeof children === "string") return statuses.has(children.trim());
  if (Array.isArray(children)) {
    return children.some((c) => typeof c === "string" && statuses.has(c.trim()));
  }
  return false;
}

// Keep the cache fresh as presences arrive, plus a periodic full rescan.
const onPresence = (payload: any) => {
  try {
    for (const u of payload?.updates ?? []) collect(u?.activities, statuses);
  } catch {}
};

scan();
FluxDispatcher?.subscribe?.("PRESENCE_UPDATES", onPresence);
const timer = setInterval(scan, 4000);

// RN's <Text> is a plain function component on this Discord build (no `.render`
// to patch), so hook element creation instead: whenever an element is created
// whose text content is a known custom status, flag it selectable.
function tweak(props: any) {
  if (!props || props.selectable || !isStatusText(props.children)) return null;
  return {
    ...props,
    selectable: true,
    onPress: typeof props.onPress === "function" ? props.onPress : () => {},
  };
}

const hooked: string[] = [];

try {
  const jsxRuntime: any = findByProps("jsx", "jsxs");
  if (jsxRuntime) {
    for (const fn of ["jsx", "jsxs"]) {
      if (typeof jsxRuntime[fn] !== "function") continue;
      before(fn, jsxRuntime, (args: any[]) => {
        const next = tweak(args[1]);
        if (next) return [args[0], next, ...args.slice(2)];
      });
    }
    hooked.push("jsx");
  }
} catch (e) {
  console.error("[CopyStatus] jsx hook failed", e);
}

try {
  if (React && typeof React.createElement === "function") {
    before("createElement", React, (args: any[]) => {
      const next = tweak(args[1]);
      if (next) return [args[0], next, ...args.slice(2)];
    });
    hooked.push("createElement");
  }
} catch (e) {
  console.error("[CopyStatus] createElement hook failed", e);
}

const patched = hooked.length > 0;

const msg = !PresenceStore
  ? "CopyStatus: PresenceStore not found"
  : !patched
    ? "CopyStatus: couldn't hook rendering"
    : `CopyStatus ready via ${hooked.join("+")} (${statuses.size} statuses known)`;
console.log(`[CopyStatus] ${msg}`);
try {
  showToast(msg);
} catch {}

export const onUnload = () => {
  clearInterval(timer);
  FluxDispatcher?.unsubscribe?.("PRESENCE_UPDATES", onPresence);
  unpatchAll();
};
