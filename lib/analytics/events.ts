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

/**
 * The brochure, opened rather than saved.
 *
 * Separate from `brochure_download` because they mean different things: a
 * visitor who opens it is still reading on the site, and one who downloads
 * it has taken it away to show somebody. The second is the stronger signal.
 */
export function trackBrochureOpened(): void {
  track('brochure_opened');
}

/**
 * The two conversions, each split into reached-the-form and actually-sent.
 *
 * These sit alongside `enquiry_started` / `enquiry_submitted` rather than
 * replacing them: the generic pair still measures the form itself, and
 * these measure the two funnels through it. Same provider, same `track`,
 * no second analytics system — the project has one and it stays one.
 *
 * As everywhere else here: no name, no email, no phone, no message.
 */
export function trackPrivateViewingStarted(): void {
  track('private_viewing_started');
}

export function trackPrivateViewingSubmitted(): void {
  track('private_viewing_submitted');
}

export function trackCommercialDemoStarted(): void {
  track('commercial_demo_started');
}

export function trackCommercialDemoSubmitted(): void {
  track('commercial_demo_submitted');
}

export function trackContactChannelClick(channel: 'whatsapp' | 'call' | 'email' | 'booking'): void {
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

/**
 * The floor plan opened.
 *
 * Distinct from selecting a room in it: reaching the drawing at all is the
 * step that says a visitor is reading the property rather than looking at
 * it, and the drop-off between opening the plan and choosing a room is the
 * thing worth seeing. No payload — which tab was opened is the whole event.
 */
export function trackFloorPlanOpened(): void {
  track('floor_plan_opened');
}

/** A room selected from the floor-plan drawing itself — separate from
 *  `trackSpaceEntered`, which also fires from the 3D rail and the journey. */
export function trackFloorPlanRoomSelected(space: string): void {
  track('floor_plan_room_selected', { space });
}

/**
 * The guided tour.
 *
 * Step id and number only. Nothing a visitor typed, and nothing that could
 * identify them — the same rule the enquiry events follow, which is why
 * `enquiry_submitted` carries an outcome and not a message.
 */
export function trackGuidedTourStarted(): void {
  track('guided_tour_started');
}

export function trackGuidedTourStepViewed(step: string, position: number): void {
  track('guided_tour_step_viewed', { step, position });
}

export function trackGuidedTourCompleted(): void {
  track('guided_tour_completed');
}

/** The tour run again from its completion card. Distinct from
 *  `guided_tour_started`, which is the first time through. */
export function trackGuidedTourReplayed(): void {
  track('guided_tour_replayed');
}

export function trackGuidedTourSkipped(): void {
  track('guided_tour_skipped');
}

/** Left partway through — `position` is the step they left from. */
export function trackGuidedTourExited(position: number): void {
  track('guided_tour_exited', { position });
}
