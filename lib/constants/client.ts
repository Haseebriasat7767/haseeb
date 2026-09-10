/**
 * Everything a paying client changes, in one file.
 *
 * ## Why this exists
 *
 * Aurelia is a demonstration of a product: a luxury property presented as
 * an experience a buyer can explore from anywhere. Selling it means
 * rebranding it for a real listing — and that has to be an afternoon's work
 * on one file, not an archaeology expedition through the components.
 *
 * So every value a client owns lives here: the residence, its figures, the
 * agent, the ways to reach them, the brochure. Nothing below is read from
 * more than one place, and no component hard-codes any of it.
 *
 * ## Honesty rules this file enforces
 *
 * Several fields are `null` rather than a placeholder, and that is
 * deliberate. A dead "Download brochure" button that downloads nothing, or
 * a WhatsApp link to a number nobody owns, is worse than the absence of the
 * feature — it is the single fastest way to lose a room. Every consumer of
 * this file treats `null` as "do not render", so an unconfigured Aurelia
 * simply has no brochure button rather than a broken one.
 *
 * ## What Aurelia is
 *
 * A conceptual residence: an architectural proposition presented as an
 * experience, built to be adapted to a real listing. The residence, the
 * studio and the client director named below are part of that proposition
 * and describe no existing property, practice or person.
 *
 * ## Contact details are never invented
 *
 * `email` and `phone` come from the environment and are `null` until set.
 * There is no placeholder address and no placeholder number anywhere in
 * this file, because a visitor who dials `+1 (000) 000-0000` learns more
 * about the state of the project than any amount of copy can undo. Set
 * `NEXT_PUBLIC_ENQUIRY_EMAIL` and, if wanted, `NEXT_PUBLIC_ENQUIRY_PHONE`
 * to switch those channels on; until then the product shows the enquiry
 * form as the single way through, which is a complete answer on its own.
 */

export type ClientConfig = {
  /** The listing itself. */
  property: {
    /** Shown as the primary name throughout. */
    name: string;
    /** Sits above the name — the development or the collection. */
    collection: string;
    location: string;
    /**
     * Asking price as it should be typeset, or `null` to show "Price on
     * application" — which is what a residence at this level usually says
     * in public anyway.
     */
    price: string | null;
    /** One sentence. It is the first thing a buyer reads. */
    statement: string;
  };

  /** Who the buyer is actually talking to. */
  agent: {
    /** Null until configured — the card omits the identity block entirely. */
    name: string | null;
    title: string | null;
    agency: string | null;
    /** From `NEXT_PUBLIC_ENQUIRY_EMAIL`. `null` hides every email channel. */
    email: string | null;
    /**
     * Display form, from `NEXT_PUBLIC_ENQUIRY_PHONE`. `null` hides every
     * call affordance. The dial string is derived below.
     */
    phone: string | null;
    /**
     * WhatsApp number in full international form, digits only, no plus and
     * no spaces — `wa.me` accepts nothing else. `null` hides every WhatsApp
     * affordance in the product rather than linking somewhere wrong.
     */
    whatsapp: string | null;
  };

  /**
   * Where the brochure is served from, or `null` to hide every download
   * affordance. Nothing here is invented marketing material: the document
   * at this path is generated at build time by `app/brochure/route.ts`
   * from the residence's own room schedule and material palette, so it
   * states only what the site already states. Point it somewhere else, or
   * set it to `null`, and the button follows.
   */
  brochurePath: string | null;
};

export const CLIENT: ClientConfig = {
  property: {
    name: 'The Aurelia Residence',
    collection: 'Aurelia',
    location: 'Coastal Ridge',
    price: null,
    statement: 'A private residence designed around light, space, and uninterrupted living.',
  },

  agent: {
    /**
     * Who the enquiry reaches.
     *
     * These were a fictional person — a name, a title and an agency invented
     * to dress the demo. That was harmless while the contact channels were
     * also unset, and stopped being harmless the moment a real email and a
     * real WhatsApp number were configured beneath them: the page then
     * states that the invented person's address is the real one, which is a
     * false claim about a real human being on a live page.
     *
     * Null unless set, and the card hides the whole identity block when
     * there is no name — the same rule every other channel here follows.
     */
    name: process.env.NEXT_PUBLIC_AGENT_NAME ?? null,
    title: process.env.NEXT_PUBLIC_AGENT_TITLE ?? null,
    agency: process.env.NEXT_PUBLIC_AGENT_AGENCY ?? null,
    email: process.env.NEXT_PUBLIC_ENQUIRY_EMAIL ?? null,
    phone: process.env.NEXT_PUBLIC_ENQUIRY_PHONE ?? null,
    // The same number the phone link uses. It was hard-coded to null, which
    // meant setting NEXT_PUBLIC_ENQUIRY_PHONE switched on the telephone
    // link and silently left WhatsApp off — a channel that looked
    // configured and was not. If a separate WhatsApp number is ever needed
    // it gets its own variable; until then one number is one number.
    whatsapp: process.env.NEXT_PUBLIC_ENQUIRY_PHONE ?? null,
  },

  brochurePath: '/brochure',
};

/**
 * A `wa.me` link with the enquiry already written, or `null` when no number
 * is configured.
 *
 * The pre-filled message matters more than it looks: a buyer who taps
 * through with the property name already in the thread has effectively
 * qualified themselves, and the agent opens a conversation that has context
 * instead of "hi".
 */
export function whatsappLink(message?: string): string | null {
  // `wa.me` takes digits only: a leading `+`, spaces, brackets or dashes all
  // produce a link that opens WhatsApp on an error rather than a chat. The
  // number is written by a human into an environment variable, so it is
  // normalised here instead of being demanded in that format.
  const number = CLIENT.agent.whatsapp?.replace(/\D/g, '');
  if (!number) return null;

  const text =
    message ?? `Hello — I'd like to arrange a private viewing of ${CLIENT.property.name}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** The phone number as a dial string, or `null` when none is configured. */
export function telLink(): string | null {
  const phone = CLIENT.agent.phone;
  if (!phone) return null;
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** A pre-addressed enquiry, or `null` when no address is configured. */
export function mailtoLink(subject?: string): string | null {
  const email = CLIENT.agent.email;
  if (!email) return null;

  const line = subject ?? `Enquiry — ${CLIENT.property.name}`;
  return `mailto:${email}?subject=${encodeURIComponent(line)}`;
}
