/**
 * The circumstances an enquiry arrived in.
 *
 * ## Why this is worth sending
 *
 * "Someone asked for a viewing" and "someone asked for a viewing after
 * finishing the guided tour, from the master suite, on a phone" are
 * different leads, and the second one is answered differently. None of it
 * requires knowing anything more about the person than they already typed
 * into the form.
 *
 * ## What is deliberately not here
 *
 * No IP, no user agent, no referrer, no session or device identifier, no
 * cookie, nothing derived from any of them. Every field below describes
 * what the visitor was *looking at* — the building, the room, the path —
 * and none of it identifies who they are. That boundary is the whole
 * design: this object is emailed to the client in plain text, so anything
 * in it is something the client is being handed about a person who has not
 * agreed to it, and the only defensible answer is to carry none of it.
 *
 * The same rule the analytics events follow, for the same reason.
 */
export type LeadContext = {
  /** `residence` or `tower`, when the enquiry began inside one. */
  building?: string;
  /** The space framed when they left for the form. */
  space?: string;
  /** Whether they reached the end of the guided tour. */
  tourCompleted?: boolean;
  /** Which call to action they came through. */
  source?: string;
  /** The page the enquiry started from. */
  path?: string;
};

/** Reads the context a CTA stashed for the form, and clears it. */
const KEY = 'aurelia:lead-context';

/**
 * Records where an enquiry is coming from, for the form on the next page.
 *
 * `sessionStorage` rather than a query string: the context is for the
 * client reading the lead, not something to hang in the visitor's address
 * bar where it would survive being shared. Wrapped because it throws
 * outright in a private window and in an embedded webview, and a dead
 * storage API must never be the reason a CTA stops working.
 */
export function rememberLeadContext(context: LeadContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(context));
  } catch {
    // No storage, no context. The enquiry itself still goes.
  }
}

/** Takes the stored context, if any, and removes it. */
export function takeLeadContext(): LeadContext {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    sessionStorage.removeItem(KEY);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LeadContext;
  } catch {
    return {};
  }
}

/** The context as the client reads it in the email, shortest form first. */
export function describeLeadContext(context: LeadContext): ReadonlyArray<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (context.source) rows.push(['Came through', context.source]);
  if (context.building) rows.push(['Building', context.building]);
  if (context.space) rows.push(['Last viewing', context.space]);
  if (context.tourCompleted !== undefined) {
    rows.push(['Guided tour', context.tourCompleted ? 'Completed' : 'Not completed']);
  }
  if (context.path) rows.push(['Page', context.path]);
  return rows;
}
