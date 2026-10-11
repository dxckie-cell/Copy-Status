import { find } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { after, unpatchAll } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Discord's mobile client doesn't expose a stable name for the profile status
// bubble, so instead of guessing one name we scan every loaded module for
// components whose name looks status-related and patch all of them.
const NAME_RE = /status|bubble|thought/i;
const SKIP_RE = /statusbar|status.?bar|indicator|avatar|presence.?dot|voice|stage/i;

function makeSelectable(node: any, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 40) return;

  // Discord wraps RN's Text in its own components, so besides RN Text itself
  // also treat any element that directly renders a string as text.
  const kids = node.props?.children;
  const rendersText =
    node.type === ReactNative.Text ||
    typeof kids === "string" ||
    (Array.isArray(kids) && kids.length > 0 && kids.every((k: any) => typeof k === "string"));
  if (rendersText && node.props) {
    node.props.selectable = true;
    if (typeof node.props.onPress !== "function") node.props.onPress = () => {};
  }

  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) makeSelectable(child, depth + 1);
  } else if (children && typeof children === "object") {
    makeSelectable(children, depth + 1);
  }
}

function patchResult(_: any, res: any) {
  if (res?.props) makeSelectable(res);
  return res;
}

const seen = new Set<any>();
const patchedNames: string[] = [];

function tryPatch(mod: any, name: string) {
  if (!mod || seen.has(mod)) return;
  seen.add(mod);
  try {
    if (typeof mod.default === "function") {
      after("default", mod, patchResult);
      patchedNames.push(mod.default.name || name);
    } else if (typeof mod.type === "function") {
      after("type", mod, patchResult);
      patchedNames.push(name);
    }
  } catch (e) {
    console.error("[CopyStatus] patch failed for", name, e);
  }
}

try {
  // `find` walks every module; returning false keeps it walking.
  find((m: any) => {
    try {
      if (!m || (typeof m !== "object" && typeof m !== "function")) return false;
      const name: string | undefined =
        m.default?.displayName ?? m.default?.name ?? m.displayName ?? m.name;
      if (typeof name === "string" && NAME_RE.test(name) && !SKIP_RE.test(name)) {
        tryPatch(m.default ? m : { default: m }, name);
      }
    } catch {}
    return false;
  });
} catch (e) {
  console.error("[CopyStatus] scan failed", e);
}

const uniq = [...new Set(patchedNames)];
const summary = uniq.length
  ? `CopyStatus patched ${uniq.length}: ${uniq.slice(0, 6).join(", ")}`
  : "CopyStatus: no status component found";
console.log(`[CopyStatus] ${summary}`);
try {
  showToast(summary);
} catch {}

export const onUnload = () => unpatchAll();
