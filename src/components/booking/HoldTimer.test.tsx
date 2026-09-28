import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HoldTimer } from "./HoldTimer";

describe("HoldTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onExpire exactly once when the hold's expiry time passes", () => {
    const onExpire = vi.fn();
    const expiresAt = new Date(Date.now() + 5000).toISOString();

    render(<HoldTimer expiresAt={expiresAt} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
