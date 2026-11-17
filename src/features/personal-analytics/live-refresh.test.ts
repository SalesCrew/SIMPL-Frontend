import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_REFRESH_INTERVAL_MS, startLiveRefresh } from './live-refresh';

describe('live report refresh lifecycle', () => {
  let stop: (() => void) | undefined;
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-17T11:00:00Z')); });
  afterEach(() => { stop?.(); stop=undefined; vi.useRealTimers(); });
  function setup() {
    const page=Object.assign(new EventTarget(),{visibilityState:'visible'}),browser=new EventTarget(),refresh=vi.fn();
    let loading=false;
    stop=startLiveRefresh(refresh,()=>loading,page as unknown as Document,browser as unknown as Window);
    return {page,browser,refresh,setLoading:(value:boolean)=>{loading=value;}};
  }
  it('refreshes every minute without adding a duplicate initial request', () => {
    const {refresh}=setup(); expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LIVE_REFRESH_INTERVAL_MS-1);expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(LIVE_REFRESH_INTERVAL_MS);expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('pauses while hidden and catches up on return without duplicate focus requests', () => {
    const {page,browser,refresh}=setup();page.visibilityState='hidden';
    vi.advanceTimersByTime(3*LIVE_REFRESH_INTERVAL_MS);expect(refresh).not.toHaveBeenCalled();
    page.visibilityState='visible';page.dispatchEvent(new Event('visibilitychange'));browser.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('does not interrupt an in-flight read and refreshes after reconnecting', () => {
    const {browser,refresh,setLoading}=setup();setLoading(true);
    vi.advanceTimersByTime(LIVE_REFRESH_INTERVAL_MS);browser.dispatchEvent(new Event('online'));expect(refresh).not.toHaveBeenCalled();
    setLoading(false);browser.dispatchEvent(new Event('online'));expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('removes timers and listeners when leaving the page or changing the owner', () => {
    const {page,browser,refresh}=setup();stop!();stop=undefined;
    vi.advanceTimersByTime(2*LIVE_REFRESH_INTERVAL_MS);page.dispatchEvent(new Event('visibilitychange'));browser.dispatchEvent(new Event('focus'));browser.dispatchEvent(new Event('online'));
    expect(refresh).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  });
});
