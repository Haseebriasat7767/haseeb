import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  submitEnquiry,
  validateEnquiry,
  type Enquiry,
} from '@/lib/contact/enquiry';

const base: Enquiry = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '',
  preferredDate: '',
  message: 'I would like to arrange a private viewing next week.',
};

describe('validateEnquiry', () => {
  it('accepts a submission a real person would make', () => {
    expect(validateEnquiry(base)).toEqual({});
  });

  it('treats the optional fields as optional', () => {
    expect(validateEnquiry({ ...base, phone: '', preferredDate: '' })).toEqual({});
  });

  it.each([
    ['a single letter', 'A'],
    ['whitespace only', '   '],
    ['nothing', ''],
  ])('rejects a name that is %s', (_label, name) => {
    expect(validateEnquiry({ ...base, name })).toHaveProperty('name');
  });

  it('rejects a name that is too long', () => {
    expect(validateEnquiry({ ...base, name: 'A'.repeat(MAX_NAME_LENGTH + 1) })).toHaveProperty('name');
  });

  it.each(['not-an-address', 'missing@tld', '@example.com', 'spaces in@example.com', ''])(
    'rejects %s as an email address',
    (email) => {
      expect(validateEnquiry({ ...base, email })).toHaveProperty('email');
    },
  );

  it.each(['ada@example.com', 'first.last+tag@sub.example.co.uk'])('accepts %s', (email) => {
    expect(validateEnquiry({ ...base, email })).not.toHaveProperty('email');
  });

  it('asks for a message with something in it', () => {
    expect(validateEnquiry({ ...base, message: 'hi' })).toHaveProperty('message');
    expect(validateEnquiry({ ...base, message: '          ' })).toHaveProperty('message');
  });

  it('rejects a message that is too long', () => {
    expect(
      validateEnquiry({ ...base, message: 'A'.repeat(MAX_MESSAGE_LENGTH + 1) }),
    ).toHaveProperty('message');
  });

  it('validates optional phone when provided', () => {
    expect(validateEnquiry({ ...base, phone: '123' })).toHaveProperty('phone');
    expect(validateEnquiry({ ...base, phone: '+971501234567' })).not.toHaveProperty('phone');
    expect(validateEnquiry({ ...base, phone: '' })).not.toHaveProperty('phone');
  });

  it('reports every problem at once rather than one at a time', () => {
    expect(
      Object.keys(
        validateEnquiry({ name: '', email: 'x', phone: '', preferredDate: '', message: '' }),
      ),
    ).toEqual(expect.arrayContaining(['name', 'email', 'message']));
  });
});

describe('submitEnquiry', () => {
  afterEach(() => vi.unstubAllGlobals());

  function respondWith(status: number) {
    const fetchMock = vi.fn(async () => new Response(null, { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('reports a send when the route accepts it', async () => {
    respondWith(200);
    await expect(submitEnquiry(base, 'to@example.com')).resolves.toEqual({ status: 'sent' });
  });

  it('falls back to a mail draft when the server has no credentials', async () => {
    respondWith(503);
    const result = await submitEnquiry(base, 'to@example.com');

    expect(result.status).toBe('unconfigured');
    if (result.status !== 'unconfigured') throw new Error('unreachable');
    expect(result.mailto).toContain('mailto:to@example.com');
    expect(decodeURIComponent(result.mailto)).toContain(base.message);
    expect(decodeURIComponent(result.mailto)).toContain(base.email);
  });

  it('still returns the composed message when there is nowhere to send it', async () => {
    respondWith(503);
    const result = await submitEnquiry(base, null);

    expect(result.status).toBe('undeliverable');
    if (result.status !== 'undeliverable') throw new Error('unreachable');
    expect(result.body).toContain(base.message);
  });

  it('distinguishes being rate limited from failing', async () => {
    respondWith(429);
    await expect(submitEnquiry(base, 'to@example.com')).resolves.toEqual({ status: 'rateLimited' });
  });

  it('throws on a real failure rather than reporting success', async () => {
    respondWith(502);
    await expect(submitEnquiry(base, 'to@example.com')).rejects.toThrow(/502/);
  });

  it('sends the anti-spam signals with the enquiry', async () => {
    const fetchMock = respondWith(200);
    await submitEnquiry(base, null, { company: '', elapsed: 8000 });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body).toMatchObject({ company: '', elapsed: 8000, email: base.email });
  });
});
