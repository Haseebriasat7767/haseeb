import { CLIENT, telLink, whatsappLink } from '@/lib/constants/client';

/**
 * Who the buyer is actually talking to, and every direct way to reach them.
 *
 * ## Why a named person
 *
 * A form alone converts badly at this price point. A buyer considering a
 * residence of this kind is not filling in a web form to reach a company —
 * they are deciding whether to start a conversation with a person, and the
 * page has to show them who that is before they will. Name, title, agency,
 * and three unmediated channels beside the form.
 *
 * ## Why the channels can vanish
 *
 * Every affordance below is driven by `lib/constants/client.ts` and is
 * simply not rendered when unconfigured. A WhatsApp button linking to a
 * number nobody owns, or a brochure button downloading nothing, does more
 * damage in a client meeting than the absence of the feature — so the
 * absence is what happens. See the honesty note in that file.
 */
export function AgentCard() {
  const whatsapp = whatsappLink();
  const { agent, property, brochurePath } = CLIENT;

  return (
    <div className="border-alabaster/10 bg-alabaster/[0.03] flex flex-col gap-8 border p-8 sm:p-10">
      <div className="flex flex-col gap-1">
        <p className="text-eyebrow text-stone uppercase">Private client</p>
        <p className="font-display text-alabaster mt-3 text-2xl leading-tight font-light">
          {agent.name}
        </p>
        <p className="text-mist text-sm">{agent.title}</p>
        <p className="text-stone text-sm">{agent.agency}</p>
      </div>

      <div className="rule" />

      <ul className="flex flex-col gap-3">
        {whatsapp ? (
          <li>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              className="text-eyebrow ease-luxe border-alabaster/20 text-alabaster hover:border-gold hover:text-gold flex items-center justify-between border px-5 py-4 uppercase transition-colors duration-300"
            >
              WhatsApp
              <span aria-hidden="true">→</span>
            </a>
          </li>
        ) : null}

        <li>
          <a
            href={telLink()}
            data-cursor="link"
            className="text-eyebrow ease-luxe border-alabaster/20 text-alabaster hover:border-gold hover:text-gold flex items-center justify-between border px-5 py-4 uppercase transition-colors duration-300"
          >
            Call
            <span aria-hidden="true" className="text-stone normal-case">
              {agent.phone}
            </span>
          </a>
        </li>

        <li>
          <a
            href={`mailto:${agent.email}?subject=${encodeURIComponent(
              `Enquiry — ${property.name}`,
            )}`}
            data-cursor="link"
            className="text-eyebrow ease-luxe border-alabaster/20 text-alabaster hover:border-gold hover:text-gold flex items-center justify-between border px-5 py-4 uppercase transition-colors duration-300"
          >
            Email
            <span aria-hidden="true">→</span>
          </a>
        </li>

        {brochurePath ? (
          <li>
            <a
              href={brochurePath}
              download
              data-cursor="link"
              className="text-eyebrow ease-luxe border-alabaster/20 text-alabaster hover:border-gold hover:text-gold flex items-center justify-between border px-5 py-4 uppercase transition-colors duration-300"
            >
              Download brochure
              <span aria-hidden="true">↓</span>
            </a>
          </li>
        ) : null}
      </ul>

      <p className="text-stone text-xs leading-relaxed">
        {property.price ?? 'Price on application'} · {property.location}
      </p>
    </div>
  );
}

export default AgentCard;
