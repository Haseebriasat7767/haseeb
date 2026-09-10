import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The enquiry route's decision table.
 *
 * This is the code where a wrong answer is expensive and invisible: the form
 * used to show a success state while delivering nothing, and every enquiry
 * the site took was lost. The cases below exist so that cannot come back —
 * above all `refuses to fabricate a success`, which is the whole point of
 * the route returning a status the client can act on.
 */

const sendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
  createTransport: () => ({ sendMail }),
}));

const WEB3 = { WEB3FORMS_ACCESS_KEY: 'test-access-key' };

const CONFIG = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'mailbox@example.test',
  SMTP_PASSWORD: 'app-specific-password',
  ENQUIRY_TO: 'leads@example.test',
  ENQUIRY_FROM: 'AURELIA <site@example.test>',
};

/** A submission a real person would produce. */
function valid(over: Record<string, unknown> = {}) {
  return {
    name: 'Ada Lovelace',
    email: `ada${Math.random().toString(36).slice(2, 8)}@example.com`,
    phone: '',
    preferredDate: '',
    message: 'I would like to arrange a private viewing next week.',
    elapsed: 9000,
    ...over,
  };
}

function post(body: unknown) {
  return new Request('http://localhost/api/enquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/**
 * The route under the given configuration.
 *
 * The module is imported once and shared. It reads its settings inside the
 * handler rather than at import time, so swapping the environment is enough
 * to move between a configured and an unconfigured deployment.
 *
 * The rate-limit counters are keyed by address and live for the whole file,
 * so every test that is not deliberately exercising the limiter uses its own
 * address.
 */
async function loadRoute(env: Record<string, string> = CONFIG) {
  for (const key of [...Object.keys(CONFIG), ...Object.keys(WEB3)]) delete process.env[key];
  Object.assign(process.env, env);
  return (await import('@/app/api/enquiry/route')).POST;
}

beforeEach(() => sendMail.mockReset().mockResolvedValue({ messageId: 'ok' }));
afterEach(() => {
  for (const key of [...Object.keys(CONFIG), ...Object.keys(WEB3)]) delete process.env[key];
  vi.unstubAllGlobals();
});

describe('Web3Forms delivery', () => {
  /** Their API answers 200 even on rejection, so the body decides. */
  function web3Responds(body: unknown, status = 200) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('posts the enquiry and reports it sent', async () => {
    const POST = await loadRoute(WEB3);
    const fetchMock = web3Responds({ success: true });

    const response = await POST(post(valid()));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'sent' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.web3forms.com/submit');
    const sent = JSON.parse(init.body as string);
    expect(sent.access_key).toBe('test-access-key');
    expect(sent.message).toContain('private viewing');
  });

  it('refuses to report success when the key is rejected', async () => {
    // The trap: Web3Forms answers HTTP 200 with success:false. Trusting the
    // status code alone would report a delivery that never happened.
    const POST = await loadRoute(WEB3);
    web3Responds({ success: false, message: 'Invalid access key' }, 200);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(post(valid()));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ status: 'failed' });
  });

  it('reports failure when the network drops', async () => {
    const POST = await loadRoute(WEB3);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await POST(post(valid()))).status).toBe(502);
  });

  it('is preferred over SMTP when both are configured', async () => {
    const POST = await loadRoute({ ...CONFIG, ...WEB3 });
    web3Responds({ success: true });

    expect((await POST(post(valid()))).status).toBe(200);
    // The mail transport must not also fire — one enquiry, one delivery.
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('still answers unconfigured when neither is set', async () => {
    const POST = await loadRoute({});
    expect((await POST(post(valid()))).status).toBe(503);
  });
});

describe('delivery', () => {
  it('sends the lead and an acknowledgement, and can be replied to', async () => {
    const POST = await loadRoute();
    const response = await POST(post(valid()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'sent' });
    expect(sendMail).toHaveBeenCalledTimes(2);

    const [lead, ack] = sendMail.mock.calls.map(([mail]) => mail);
    // Replying to the lead must reach the enquirer, not the site.
    expect(lead.to).toBe(CONFIG.ENQUIRY_TO);
    expect(lead.replyTo).toMatch(/@example\.com$/);
    // Replying to the acknowledgement must reach the site, not the visitor.
    expect(ack.replyTo).toBe(CONFIG.ENQUIRY_TO);
    expect(ack.to).toMatch(/@example\.com$/);
  });

  it('still reports success when only the acknowledgement fails', async () => {
    const POST = await loadRoute();
    let call = 0;
    sendMail.mockImplementation(async () => {
      call += 1;
      if (call === 2) throw new Error('bounce');
      return { messageId: 'lead' };
    });

    // The lead is already delivered. Telling the visitor their enquiry failed
    // because a courtesy email bounced would be false.
    await expect((await POST(post(valid()))).json()).resolves.toEqual({ status: 'sent' });
  });

  it('escapes user text so a message cannot inject markup into the email', async () => {
    const POST = await loadRoute();
    await POST(post(valid({ name: '<script>x</script>', message: 'a & b <img src=x> "q"' })));

    const html = sendMail.mock.calls[0]?.[0].html as string;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});

describe('refuses to fabricate a success', () => {
  it('reports failure when the mail server rejects the message', async () => {
    const POST = await loadRoute();
    // `…Once`, not a persistent implementation: a throwing mock left
    // installed past the end of the test surfaces as an unhandled rejection
    // and fails the test even though the route caught it and answered 502.
    sendMail.mockImplementationOnce(async () => {
      throw new Error('535 authentication failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(post(valid()));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ status: 'failed' });
  });

  it.each([
    ['nothing configured', {}],
    ['no password', { ...CONFIG, SMTP_PASSWORD: '' }],
    ['no host', { ...CONFIG, SMTP_HOST: '' }],
    ['no destination', { ...CONFIG, ENQUIRY_TO: '' }],
  ])('reports unconfigured when there is %s', async (_label, env) => {
    const POST = await loadRoute(env as Record<string, string>);
    const response = await POST(post(valid()));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: 'unconfigured' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('answers an unconfigured deployment honestly however many times it is asked', async () => {
    // Regression: the rate limit used to run first, so the fifth attempt on an
    // unconfigured deployment replied "we already have your enquiry" when it
    // had never had one — the same dishonesty, reached from the other side.
    const POST = await loadRoute({});
    const email = 'repeat@example.com';

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(post(valid({ email })));
      expect(response.status).toBe(503);
    }
  });
});

describe('rejects what a person would not send', () => {
  it('accepts the honeypot silently without sending', async () => {
    const POST = await loadRoute();
    // Answered 200 on purpose: a bot told it failed simply tries again.
    const response = await POST(post(valid({ company: 'spam co' })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'sent' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('accepts an impossibly fast submission silently without sending', async () => {
    const POST = await loadRoute();
    const response = await POST(post(valid({ elapsed: 120 })));

    expect(response.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('revalidates on the server rather than trusting the browser', async () => {
    const POST = await loadRoute();
    const response = await POST(post(valid({ email: 'not-an-address', name: 'x' })));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { status: string; errors: Record<string, string> };
    expect(body.status).toBe('invalid');
    expect(body.errors).toHaveProperty('email');
    expect(body.errors).toHaveProperty('name');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects a malformed body without throwing', async () => {
    const POST = await loadRoute();
    const response = await POST(post('not json at all'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ status: 'invalid' });
  });

  it('rate limits by address after four in the window', async () => {
    const POST = await loadRoute();
    const email = 'persistent@example.com';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await POST(post(valid({ email })))).status).toBe(200);
    }
    const blocked = await POST(post(valid({ email })));
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({ status: 'rateLimited' });
  });

  it('rate limits one address without affecting another', async () => {
    const POST = await loadRoute();
    for (let attempt = 0; attempt < 5; attempt += 1) await POST(post(valid({ email: 'a@x.com' })));

    expect((await POST(post(valid({ email: 'b@x.com' })))).status).toBe(200);
  });

  it('treats an address as the same person whatever its casing or spacing', async () => {
    const POST = await loadRoute();
    const forms = [' Case@X.com', 'case@x.com', 'CASE@X.COM ', 'Case@x.Com'];
    for (const email of forms) await POST(post(valid({ email })));

    expect((await POST(post(valid({ email: 'case@x.com' })))).status).toBe(429);
  });
});
