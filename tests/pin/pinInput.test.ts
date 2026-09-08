/// <reference types="node" />
import { createElement, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { readFileSync } from "fs";
import { join } from "path";

// `@expo/vector-icons` pulls in `expo-font`/`expo-asset` for real font
// loading, which isn't needed to test PinInput's interactive behavior and
// isn't resolvable in this test environment — stub it out with a plain
// component so PinInput's actual logic (the part under test) still imports
// and renders normally.
jest.mock("@expo/vector-icons", () => {
  const { createElement: h } = require("react");
  return { Ionicons: (props: Record<string, unknown>) => h("Ionicons", props) };
});

import { PinInput } from "@/components/form/PinInput";

/**
 * Regression coverage for the "first PIN field doesn't accept input" bug:
 * `app/profiles/create.tsx` and the PIN-setup/reset flow in
 * `app/profiles/index.tsx` each render TWO PinInputs, and the FIRST one had
 * `showKeypad={false}` — meaning it depended entirely on a `setTimeout`-based
 * `autoFocus` (a `focus()` call outside any user gesture, which Chromium/
 * Electron can silently drop, especially right after a route transition) to
 * ever receive input at all. The second field (which had the on-screen
 * keypad) worked, matching the exact bug report. The fix gives both fields
 * the same keypad every OTHER working PinInput in the app already has (the
 * login screen) — these tests prove the keypad path works completely
 * independent of whether autoFocus ever succeeds, and guard against the
 * `showKeypad={false}` regression ever being reintroduced on a first field.
 */

/** A controlled-component test harness mirroring how every real screen uses PinInput (value/onChange in local state). */
function Harness(props: {
  onValue: (v: string) => void;
  length?: number;
  showKeypad?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const handleChange = (v: string) => {
    props.onValue(v);
    setValue(v);
  };
  return createElement(PinInput, {
    value,
    onChange: handleChange,
    length: props.length,
    showKeypad: props.showKeypad,
    autoFocus: props.autoFocus,
  });
}

function renderHarness(onValue: (v: string) => void, extraProps: Partial<{ showKeypad: boolean; autoFocus: boolean }> = {}) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(Harness, { onValue, ...extraProps }));
  });
  return renderer;
}

function pressDigit(renderer: ReactTestRenderer, digit: string) {
  const button = renderer.root.findByProps({ accessibilityLabel: `Cijfer ${digit}` });
  act(() => {
    (button.props.onPress as () => void)();
  });
}

function pressBackspace(renderer: ReactTestRenderer) {
  const button = renderer.root.findByProps({ accessibilityLabel: "Verwijderen" });
  act(() => {
    (button.props.onPress as () => void)();
  });
}

function getHiddenTextInput(renderer: ReactTestRenderer) {
  return renderer.root.findByProps({ accessibilityLabel: "PIN-code" });
}

describe("PinInput — on-screen keypad input works, fully independent of autoFocus", () => {
  it("accepts a single digit tap via the keypad even though autoFocus was never triggered (autoFocus: false)", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v), { autoFocus: false });

    pressDigit(renderer, "1");

    expect(values).toEqual(["1"]);
  });

  it("builds up the full 4-digit PIN across sequential keypad taps — the exact real-world 'first field' scenario", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v), { autoFocus: false });

    pressDigit(renderer, "1");
    pressDigit(renderer, "2");
    pressDigit(renderer, "3");
    pressDigit(renderer, "4");

    expect(values[values.length - 1]).toBe("1234");
  });

  it("keypad backspace removes the last digit", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v));

    pressDigit(renderer, "1");
    pressDigit(renderer, "2");
    pressDigit(renderer, "3");
    pressBackspace(renderer);

    expect(values[values.length - 1]).toBe("12");
  });

  it("never exceeds the 4-digit length via the keypad, even with a 5th tap", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v));

    for (const digit of ["1", "2", "3", "4", "5"]) {
      pressDigit(renderer, digit);
    }

    expect(values[values.length - 1]).toBe("1234");
  });

  it("works identically when showKeypad is the default (true) and no prop is passed at all — matches the fixed call sites", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v)); // no showKeypad override — must default to visible

    expect(() => pressDigit(renderer, "7")).not.toThrow();
    expect(values).toEqual(["7"]);
  });
});

describe("PinInput — real-keyboard/paste path (the hidden TextInput) still works as a second, independent input method", () => {
  it("accepts digits typed via a real keyboard (TextInput onChangeText)", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v));
    const input = getHiddenTextInput(renderer);

    act(() => {
      (input.props.onChangeText as (t: string) => void)("1");
    });
    act(() => {
      (input.props.onChangeText as (t: string) => void)("12");
    });

    expect(values[values.length - 1]).toBe("12");
  });

  it("strips non-digit characters from a pasted string (e.g. '12a34') down to exactly 4 digits", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v));
    const input = getHiddenTextInput(renderer);

    act(() => {
      (input.props.onChangeText as (t: string) => void)("12a34");
    });

    expect(values[values.length - 1]).toBe("1234");
  });

  it("rejects whitespace-only input as empty digits", () => {
    const values: string[] = [];
    const renderer = renderHarness((v) => values.push(v));
    const input = getHiddenTextInput(renderer);

    act(() => {
      (input.props.onChangeText as (t: string) => void)("  ");
    });

    expect(values[values.length - 1]).toBe("");
  });

  it("Enter submits only once the value is exactly 4 digits", () => {
    const onSubmit = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(PinInput, { value: "123", onChange: () => {}, onSubmit }));
    });
    const input = renderer.root.findByProps({ accessibilityLabel: "PIN-code" });

    act(() => {
      (input.props.onKeyPress as (e: unknown) => void)({ nativeEvent: { key: "Enter" } });
    });
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => {
      renderer.update(createElement(PinInput, { value: "1234", onChange: () => {}, onSubmit }));
    });
    const input2 = renderer.root.findByProps({ accessibilityLabel: "PIN-code" });
    act(() => {
      (input2.props.onKeyPress as (e: unknown) => void)({ nativeEvent: { key: "Enter" } });
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("Regression guard: the first PIN field in every profile-auth screen must always have a working keypad", () => {
  const projectRoot = join(__dirname, "..", "..");

  it("app/profiles/create.tsx never disables the keypad on either PinInput", () => {
    const source = readFileSync(join(projectRoot, "app", "profiles", "create.tsx"), "utf8");
    expect(source).not.toContain("showKeypad={false}");
  });

  it("app/profiles/index.tsx never disables the keypad on either PinInput", () => {
    const source = readFileSync(join(projectRoot, "app", "profiles", "index.tsx"), "utf8");
    expect(source).not.toContain("showKeypad={false}");
  });
});
