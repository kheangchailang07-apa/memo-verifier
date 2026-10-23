import { Agent, fetch as undiciFetch } from 'undici';

/**
 * api.telegram.org and t.me are dual-stack. On networks where the IPv6 route
 * stalls, the connection attempt hangs until the 10s abort and every Telegram
 * call fails, so all Telegram traffic is pinned to IPv4 through this agent.
 */
const ipv4Agent = new Agent({
  connect: { family: 4 },
});

export type Ipv4FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  redirect?: 'follow' | 'error' | 'manual';
  signal?: AbortSignal;
};

/** fetch() that only ever opens an IPv4 socket for the request. */
export const ipv4Fetch = async (url: string, init: Ipv4FetchInit = {}): Promise<any> =>
  undiciFetch(url, { ...init, dispatcher: ipv4Agent } as any);

export default ipv4Fetch;
