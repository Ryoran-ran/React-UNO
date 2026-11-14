import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
function worker(basePath = '/') {
  const origin = 'https://iroha.test';
  const scope = new URL(basePath, origin).href;
  const html = `<html><link href="${basePath}icon.svg"><link href="./manifest.webmanifest"><link href="./assets/style.css"><script src="./assets/app.js"></script></html>`;
  const documents = new Map([
    ['/', html],
    ['/index.html', html],
    ['/icon.svg', '<svg/>'], ['/manifest.webmanifest', '{}'], ['/assets/style.css', 'body{}'], ['/assets/app.js', 'console.log("offline")'],
  ].map(([path, body]) => [new URL(path.slice(1), scope).pathname, body]));
  let online = true; let claimed = false;
  const url = (request: Request | string) => typeof request === 'string' ? new URL(request, scope).href : request.url;
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
        match: async (request: Request | string) => cache.get(url(request))?.clone(),
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
  runInNewContext(source, { caches: cacheApi, fetch, Response, URL, self: { registration: { scope }, location: { origin }, clients: { claim: async () => { claimed = true; } }, addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback) } });
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
    const app = worker(); app.caches.set('iroha:https://iroha.test/:old', new Map()); app.caches.set('other-application', new Map());
    await app.lifecycle('install'); await app.lifecycle('activate');
    expect(app.caches.has('iroha:https://iroha.test/:old')).toBe(false); expect(app.caches.has('other-application')).toBe(true); expect(app.isClaimed()).toBe(true);
  });
  it('does not intercept third-party requests', async () => {
    const app = worker(); expect(await app.request('https://other.test/asset.js', 'cors')).toBeUndefined();
  });
  it('caches the full application under a GitHub Pages repository path', async () => {
    const app = worker('/React-UNO/'); await app.lifecycle('install'); app.setOffline();
    expect((await app.request('/React-UNO/'))?.ok).toBe(true);
    expect(await (await app.request('/React-UNO/assets/app.js', 'cors'))?.text()).toContain('offline');
    expect(await (await app.request('/React-UNO/assets/style.css', 'cors'))?.text()).toBe('body{}');
    expect(await (await app.request('/React-UNO/icon.svg', 'cors'))?.text()).toBe('<svg/>');
    expect(await (await app.request('/React-UNO/another-route'))?.text()).toContain('<html>');
  });
  it('preserves caches and requests belonging to other projects on the same Pages origin', async () => {
    const app = worker('/React-UNO/');
    const other = 'iroha:https://iroha.test/other-game/:v2';
    app.caches.set(other, new Map());
    app.caches.set('iroha:https://iroha.test/React-UNO/:old', new Map());
    await app.lifecycle('install'); await app.lifecycle('activate');
    expect(app.caches.has(other)).toBe(true);
    expect(app.caches.has('iroha:https://iroha.test/React-UNO/:old')).toBe(false);
    expect(await app.request('/other-game/')).toBeUndefined();
    expect(await app.request('/icon.svg', 'cors')).toBeUndefined();
  });
});
