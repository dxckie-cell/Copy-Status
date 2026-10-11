import { findByName, findByTypeName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { after, unpatchAll } from "@vendetta/patcher";

// Candidate component names Discord has used for the custom status bubble on
// profiles. Every one that exists in the running client gets patched.
const CANDIDATES = [
  "UserProfileCustomStatus",
  "CustomStatusBubble",
  "ProfileCustomStatus",
  "CustomStatus",
  "UserProfileStatus",
  "StatusBubble",
  "ProfileBubble",
];

function makeSelectable(node: any): void {
  if (!node || typeof node !== "object") return;

  if (node.type === ReactNative.Text) {
    node.props.selectable = true;

    // A Text without onPress ignores long-press selection in some parents.
    if (typeof node.props.onPress !== "function") {
      node.props.onPress = () => {};
    }
  }

  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) makeSelectable(child);
  } else if (children && typeof children === "object") {
    makeSelectable(children);
  }
}

function patchResult(_: any, res: any) {
  if (!res?.props) return res;
  makeSelectable(res);
  return res;
}

function tryPatch(target: any): boolean {
  if (!target) return false;
  try {
    if (typeof target.default === "function") {
      after("default", target, patchResult);
      return true;
    }
    // memo()/forwardRef() components expose the render function as `type`
    if (typeof target.type === "function") {
      after("type", target, patchResult);
      return true;
    }
  } catch (e) {
    console.error("[CopyStatus] patch failed", e);
  }
  return false;
}

const patched = new Set<string>();

for (const name of CANDIDATES) {
  const found = findByName(name, false) ?? findByTypeName(name);
  if (tryPatch(found)) patched.add(name);
}

console.log(
  `[CopyStatus] patched: ${patched.size ? [...patched].join(", ") : "nothing (no matching component found)"}`
);

export const onUnload = () => unpatchAll();
