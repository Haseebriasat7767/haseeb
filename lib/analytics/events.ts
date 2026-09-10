'use client';

import { track } from '@vercel/analytics';

/**
 * The handful of moments on this site that mean something to a developer
 * pitching it, or to us reading how it's actually used. Page views alone
 * cannot tell you whether anyone reached the tower, opened the brochure,
 * or started a form and gave up — this is that.
 *
 * Typed helpers rather than bare `track(...)` calls at each site, so an
 * event name is a function signature instead of a string that can drift
 * between call sites with no error.
 */

export function trackBrochureDownload(): void {
  track('brochure_download');
}

export function trackContactChannelClick(channel: 'whatsapp' | 'call' | 'email'): void {
  track('contact_channel_click', { channel });
}

export function trackSpaceEntered(space: string, building: 'residence' | 'tower'): void {
  track('space_entered', { space, building });
}

export function trackEnquiryStarted(): void {
  track('enquiry_started');
}

export function trackEnquirySubmitted(
  outcome: 'sent' | 'rateLimited' | 'unconfigured' | 'undeliverable' | 'failed',
): void {
  track('enquiry_submitted', { outcome });
}
