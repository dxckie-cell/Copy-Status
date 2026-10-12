import { findByStoreName } from "@vendetta/metro";
import { ReactNative, FluxDispatcher } from "@vendetta/metro/common";
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

const Text: any = ReactNative.Text;
let patched = false;
try {
  if (Text && typeof Text.render === "function") {
    before("render", Text, ([props, ref]: any[]) => {
      if (!props || props.selectable) return;
      if (isStatusText(props.children)) {
        return [
          {
            ...props,
            selectable: true,
            onPress: typeof props.onPress === "function" ? props.onPress : () => {},
          },
          ref,
        ];
      }
    });
    patched = true;
  }
} catch (e) {
  console.error("[CopyStatus] patch failed", e);
}

const msg = !PresenceStore
  ? "CopyStatus: PresenceStore not found"
  : !patched
    ? "CopyStatus: couldn't hook Text"
    : `CopyStatus ready (${statuses.size} statuses known)`;
console.log(`[CopyStatus] ${msg}`);
try {
  showToast(msg);
} catch {}

export const onUnload = () => {
  clearInterval(timer);
  FluxDispatcher?.unsubscribe?.("PRESENCE_UPDATES", onPresence);
  unpatchAll();
};
