import { findByProps, findByStoreName } from "@vendetta/metro";
import { React, FluxDispatcher } from "@vendetta/metro/common";
import { before, unpatchAll } from "@vendetta/patcher";

const PresenceStore: any = findByStoreName("PresenceStore");
let statuses = new Set<string>();

// Custom status = activity type 4, text in `state`.
const collect = (acts: any, into: Set<string>) => {
  for (const a of acts ?? []) {
    if (a?.type === 4 && a.state?.trim()) into.add(a.state.trim());
  }
};

const scan = () => {
  try {
    const next = new Set<string>();
    for (const id of PresenceStore.getUserIds()) collect(PresenceStore.getActivities(id), next);
    statuses = next;
  } catch {}
};

const onPresence = ({ updates }: any) => {
  try {
    for (const u of updates ?? []) collect(u.activities, statuses);
  } catch {}
};

scan();
FluxDispatcher.subscribe("PRESENCE_UPDATES", onPresence);
const timer = setInterval(scan, 4000);

const isStatus = (c: any) =>
  statuses.size > 0 &&
  (typeof c === "string"
    ? statuses.has(c.trim())
    : Array.isArray(c) && c.some((x) => typeof x === "string" && statuses.has(x.trim())));

// Make any element whose text is a known custom status selectable.
const hook = ([type, props, ...rest]: any[]) => {
  if (props && !props.selectable && isStatus(props.children)) {
    return [type, { ...props, selectable: true, onPress: props.onPress ?? (() => {}) }, ...rest];
  }
};

const jsx: any = findByProps("jsx", "jsxs");
if (jsx) {
  before("jsx", jsx, hook);
  before("jsxs", jsx, hook);
}
before("createElement", React, hook);

export const onUnload = () => {
  clearInterval(timer);
  FluxDispatcher.unsubscribe("PRESENCE_UPDATES", onPresence);
  unpatchAll();
};
