import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Client configuration, and what happens when it is absent.
 *
 * The absent case is the one that matters: Aurelia ships unbranded and is
 * demonstrated unbranded, so every identity value has to be missing without
 * leaving a hole where a name should be. These assert the config layer
 * itself — that a value survives, is normalised, or is refused — which is
 * what the components then key their rendering off.
 */

const KEYS = [
  'NEXT_PUBLIC_AGENT_NAME',
  'NEXT_PUBLIC_AGENT_TITLE',
  'NEXT_PUBLIC_AGENT_AGENCY',
  'NEXT_PUBLIC_AGENT_PHOTO',
  'NEXT_PUBLIC_CLIENT_LOGO',
  'NEXT_PUBLIC_CLIENT_WEBSITE',
  'NEXT_PUBLIC_CTA_LABEL',
];

const ORIGINAL = { ...process.env };

async function loadClient(env: Record<string, string> = {}) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  return import('@/lib/constants/client');
}

beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('client identity configuration', () => {
  it('leaves every identity value null when nothing is configured', async () => {
    const { CLIENT } = await loadClient();
    expect(CLIENT.agent.name).toBeNull();
    expect(CLIENT.agent.agency).toBeNull();
    expect(CLIENT.links.logo).toBeNull();
    expect(CLIENT.links.agentPhoto).toBeNull();
    expect(CLIENT.links.website).toBeNull();
  });

  it('carries a configured identity through', async () => {
    const { CLIENT } = await loadClient({
      NEXT_PUBLIC_AGENT_NAME: 'A. Advisor',
      NEXT_PUBLIC_AGENT_AGENCY: 'Ridgeline Partners',
      NEXT_PUBLIC_AGENT_PHOTO: '/advisor.jpg',
      NEXT_PUBLIC_CLIENT_LOGO: '/logo.svg',
    });
    expect(CLIENT.agent.name).toBe('A. Advisor');
    expect(CLIENT.agent.agency).toBe('Ridgeline Partners');
    expect(CLIENT.links.agentPhoto).toBe('/advisor.jpg');
    expect(CLIENT.links.logo).toBe('/logo.svg');
  });

  it('refuses an off-site asset path', async () => {
    // An external image would hand a third party a request log of every
    // visitor to the page it appears on.
    const { CLIENT } = await loadClient({
      NEXT_PUBLIC_CLIENT_LOGO: 'https://cdn.example.com/logo.svg',
      NEXT_PUBLIC_AGENT_PHOTO: '//evil.example/p.jpg',
    });
    expect(CLIENT.links.logo).toBeNull();
    expect(CLIENT.links.agentPhoto).toBeNull();
  });

  it('refuses a website or booking URL that is not https', async () => {
    const { CLIENT } = await loadClient({
      NEXT_PUBLIC_CLIENT_WEBSITE: 'http://insecure.example',
    });
    expect(CLIENT.links.website).toBeNull();
  });

  it('refuses a javascript: URL outright', async () => {
    const { CLIENT } = await loadClient({
      NEXT_PUBLIC_CLIENT_WEBSITE: 'javascript:alert(1)',
    });
    expect(CLIENT.links.website).toBeNull();
  });

  it('treats an empty or whitespace value as unconfigured', async () => {
    const { CLIENT } = await loadClient({
      NEXT_PUBLIC_AGENT_NAME: '   ',
      NEXT_PUBLIC_CLIENT_LOGO: '',
    });
    expect(CLIENT.agent.name).toBeNull();
    expect(CLIENT.links.logo).toBeNull();
  });

  it('falls back to the default CTA label when none is set', async () => {
    const { primaryCtaLabel } = await loadClient();
    expect(primaryCtaLabel()).toBe('Request a private viewing');
    const configured = await loadClient({ NEXT_PUBLIC_CTA_LABEL: 'Arrange a viewing' });
    expect(configured.primaryCtaLabel()).toBe('Arrange a viewing');
  });
});
