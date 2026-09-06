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
 * The residence, the studio, the agent and the address below are fictional,
 * and the contact details resolve to the reserved `example.com` domain by
 * design. Nothing here describes a real property or a real practice.
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
    name: string;
    title: string;
    agency: string;
    email: string;
    /** Display form. The dial string is derived below. */
    phone: string;
    /**
     * WhatsApp number in full international form, digits only, no plus and
     * no spaces — `wa.me` accepts nothing else. `null` hides every WhatsApp
     * affordance in the product rather than linking somewhere wrong.
     */
    whatsapp: string | null;
  };

  /**
   * Path to a real brochure in `public/`, or `null`. There is no brochure
   * in this repository and none is invented: fabricating a developer's
   * marketing material is not a thing to do, so the button simply does not
   * appear until a real file is dropped in and named here.
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
    name: 'Elena Marchetti',
    title: 'Private Client Director',
    agency: 'Aurelia Estates',
    email: 'enquiries@aurelia.example.com',
    phone: '+1 (000) 000-0000',
    // Unset by design — see the note on the type above. Replace with a real
    // number, digits only (for example '447700900123'), to switch on the
    // WhatsApp button everywhere it appears.
    whatsapp: null,
  },

  brochurePath: null,
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
  const number = CLIENT.agent.whatsapp;
  if (!number) return null;

  const text =
    message ?? `Hello — I'd like to arrange a private viewing of ${CLIENT.property.name}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** The phone number as a dial string, stripped of display formatting. */
export function telLink(): string {
  return `tel:${CLIENT.agent.phone.replace(/[^\d+]/g, '')}`;
}
