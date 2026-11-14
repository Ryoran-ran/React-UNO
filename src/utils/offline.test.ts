import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
function worker() {
  const origin = 'https://iroha.test';
  const documents = new Map([
    ['/', '<html><link href="./icon.svg"><link href="./manifest.webmanifest"><link href="./assets/style.css"><script src="./assets/app.js"></script></html>'],
    ['/index.html', '<html><link href="./icon.svg"><link href="./manifest.webmanifest"><link href="./assets/style.css"><script src="./assets/app.js"></script></html>'],
    ['/icon.svg', '<svg/>'], ['/manifest.webmanifest', '{}'], ['/assets/style.css', 'body{}'], ['/assets/app.js', 'console.log("offline")'],
  ]);
  let online = true; let claimed = false;
  const url = (request: Request | string) => typeof request === 'string' ? new URL(request, origin).href : request.url;
  const caches = new Map<string, Map<string, Response>>();
  const fetch = async (request: Request | string) => {
    if (!online) throw new Error('offline');
    const body = documents.get(new URL(url(request)).pathname);
    return new Response(body ?? '404', { status: body === undefined ? 404 : 200 });
  };
  const cacheApi = {
    open: async (key: string) => {
      const cache = caches.get(key) ?? new Map<string, Response>(); caches.set(key, cache);
      return {
        put: async (request: Request | string, response: Response) => { cache.set(url(request), response.clone()); },
        addAll: async (requests: string[]) => {
          if (new Set(requests.map(url)).size !== requests.length) throw new Error('duplicate Cache.addAll request');
          for (const request of requests) { const response = await fetch(request); if (!response.ok) throw new Error('fetch failed'); cache.set(url(request), response); }
        },
      };
    },
    match: async (request: Request | string) => {
      for (const cache of caches.values()) { const result = cache.get(url(request)); if (result) return result.clone(); }
      return undefined;
    },
    keys: async () => [...caches.keys()], delete: async (key: string) => caches.delete(key),
  };
  const listeners = new Map<string, (event: unknown) => void>();
  runInNewContext(source, { caches: cacheApi, fetch, Response, URL, self: { location: { origin }, clients: { claim: async () => { claimed = true; } }, addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback) } });
  return {
    caches, setOffline: () => { online = false; }, isClaimed: () => claimed,
    lifecycle: async (type: string) => { let work: Promise<unknown> | undefined; listeners.get(type)!({ waitUntil: (promise: Promise<unknown>) => { work = promise; } }); await work; },
    request: async (path: string, mode = 'navigate') => {
      let response: Promise<Response> | undefined;
      const waits: Promise<unknown>[] = [];
      listeners.get('fetch')!({ request: { url: new URL(path, origin).href, method: 'GET', mode }, waitUntil: (work: Promise<unknown>) => waits.push(work), respondWith: (work: Promise<Response>) => { response = work; } });
      const result = await response; await Promise.all(waits); return result;
    },
  };
}
describe('offline worker lifecycle and asset cache', () => {
  it('installs without duplicate cache requests and serves HTML, JS and CSS offline', async () => {
    const app = worker(); await app.lifecycle('install'); app.setOffline();
    expect((await app.request('/'))?.ok).toBe(true);
    expect(await (await app.request('/assets/app.js', 'cors'))?.text()).toContain('offline');
    expect(await (await app.request('/assets/style.css', 'cors'))?.text()).toBe('body{}');
    expect(await (await app.request('/another-route'))?.text()).toContain('<html>');
    expect((await app.request('/missing.png', 'cors'))?.type).toBe('error');
  });
  it('only removes obsolete IROHA caches, preserving other applications', async () => {
    const app = worker(); app.caches.set('iroha-old', new Map()); app.caches.set('other-application', new Map());
    await app.lifecycle('install'); await app.lifecycle('activate');
    expect(app.caches.has('iroha-old')).toBe(false); expect(app.caches.has('other-application')).toBe(true); expect(app.isClaimed()).toBe(true);
  });
  it('does not intercept third-party requests', async () => {
    const app = worker(); expect(await app.request('https://other.test/asset.js', 'cors')).toBeUndefined();
  });
});
