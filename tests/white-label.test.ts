import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A fully branded build, and the same build with each value taken away.
 *
 * Aurelia is demonstrated unbranded and sold branded, so both states have
 * to be right. The configured case proves a client's details actually
 * reach the product; the absent case proves the demo never shows a hole
 * where a name should be. Every value below is fictional and safe — no
 * real client credential belongs in a test.
 */

const FULL = {
  NEXT_PUBLIC_AGENT_NAME: 'R. Calloway',
  NEXT_PUBLIC_AGENT_TITLE: 'Private Client Director',
  NEXT_PUBLIC_AGENT_AGENCY: 'Ridgeline Partners',
  NEXT_PUBLIC_AGENT_PHOTO: '/advisor.jpg',
  NEXT_PUBLIC_CLIENT_LOGO: '/client-logo.svg',
  NEXT_PUBLIC_CLIENT_WEBSITE: 'https://example.com',
  NEXT_PUBLIC_CTA_LABEL: 'Arrange a viewing',
  NEXT_PUBLIC_ENQUIRY_EMAIL: 'viewings@example.com',
  NEXT_PUBLIC_ENQUIRY_PHONE: '+1 212 555 0148',
  NEXT_PUBLIC_ENQUIRY_WHATSAPP: '12125550148',
  NEXT_PUBLIC_BOOKING_URL: 'https://cal.example.com/viewings',
};

const ORIGINAL = { ...process.env };

async function load(env: Record<string, string>) {
  for (const key of Object.keys(FULL)) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  return import('@/lib/constants/client');
}

beforeEach(() => {
  for (const key of Object.keys(FULL)) delete process.env[key];
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('a fully configured client', () => {
  it('carries every value through to the product', async () => {
    const { CLIENT, primaryCtaLabel, whatsappLink, telLink, mailtoLink } = await load(FULL);

    expect(CLIENT.agent.name).toBe('R. Calloway');
    expect(CLIENT.agent.title).toBe('Private Client Director');
    expect(CLIENT.agent.agency).toBe('Ridgeline Partners');
    expect(CLIENT.links.agentPhoto).toBe('/advisor.jpg');
    expect(CLIENT.links.logo).toBe('/client-logo.svg');
    expect(CLIENT.links.website).toBe('https://example.com/');
    expect(CLIENT.links.booking).toBe('https://cal.example.com/viewings');
    expect(primaryCtaLabel()).toBe('Arrange a viewing');
    expect(telLink()).toBe('tel:+12125550148');
    expect(mailtoLink()).toContain('mailto:viewings@example.com');
    expect(whatsappLink()).toContain('https://wa.me/12125550148');
  });

  it('writes the enquiry into the WhatsApp link rather than opening with "hi"', async () => {
    const { whatsappLink } = await load(FULL);
    const link = whatsappLink('Hello — I would like a private viewing.');
    expect(link).toContain(encodeURIComponent('Hello'));
    expect(link).toContain(encodeURIComponent('private viewing'));
  });

  it('reports that a contact channel exists', async () => {
    const { hasContactChannel } = await load(FULL);
    expect(hasContactChannel()).toBe(true);
  });
});

describe('each value removed on its own', () => {
  // Every optional field, dropped one at a time from an otherwise complete
  // configuration. None may take anything else down with it.
  for (const key of Object.keys(FULL)) {
    it(`survives ${key} being unset`, async () => {
      const partial = { ...FULL };
      delete (partial as Record<string, string>)[key];
      const { CLIENT, primaryCtaLabel } = await load(partial);

      // The product still has a name, a statement and a brochure whatever
      // the client has or has not configured.
      expect(CLIENT.property.name.length).toBeGreaterThan(0);
      expect(CLIENT.property.statement.length).toBeGreaterThan(0);
      expect(typeof primaryCtaLabel()).toBe('string');
      expect(primaryCtaLabel().length).toBeGreaterThan(0);

      // Nothing ever becomes the string "undefined", an empty label, or a
      // placeholder — the three ways this fails visibly on a live page.
      const values = [
        CLIENT.agent.name,
        CLIENT.agent.agency,
        CLIENT.links.logo,
        CLIENT.links.agentPhoto,
        CLIENT.links.website,
        CLIENT.links.booking,
      ];
      for (const value of values) {
        expect(value === null || (typeof value === 'string' && value.trim().length > 0)).toBe(true);
        expect(String(value)).not.toMatch(/undefined|example\.com\/your|placeholder|TODO/i);
      }
    });
  }

  it('hides every channel when nothing at all is configured', async () => {
    const { CLIENT, hasContactChannel, whatsappLink, telLink, mailtoLink } = await load({});
    expect(hasContactChannel()).toBe(false);
    expect(whatsappLink()).toBeNull();
    expect(telLink()).toBeNull();
    expect(mailtoLink()).toBeNull();
    expect(CLIENT.links.booking).toBeNull();
    // And still names no one.
    expect(CLIENT.agent.name).toBeNull();
    expect(CLIENT.agent.agency).toBeNull();
  });
});
