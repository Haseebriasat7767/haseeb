'use client';

import Image from 'next/image';
import { useState } from 'react';
import { CLIENT } from '@/lib/constants/client';
import { cn } from '@/lib/utils/cn';

/**
 * Who is presenting the property, when a client has said.
 *
 * ## Why it renders nothing by default
 *
 * Aurelia ships unbranded. Every value below is `null` until an operator
 * sets it, and the component returns `null` rather than drawing a frame
 * around the absence — an empty "Presented by" with a blank underneath
 * tells a visitor the site is half-built, which is the one thing a sales
 * tool cannot afford to say. Same rule the contact channels already
 * follow: configured or invisible, never placeheld.
 *
 * ## Why the photograph can disappear on its own
 *
 * A configured path can still fail — the file was renamed, the deploy
 * dropped it, the CDN is cold. A broken-image glyph beside an advisor's
 * name reads worse than no portrait at all, so a failed load removes the
 * image and the rest of the identity stands without it.
 */
export function ClientIdentity({ className }: { className?: string }) {
  const { agent, links } = CLIENT;
  const [photoFailed, setPhotoFailed] = useState(false);

  const photo = links.agentPhoto && !photoFailed ? links.agentPhoto : null;
  // `title` alone is not an identity: it defaults to "Direct enquiries" so
  // the contact card has something to head its channels with, and on its
  // own it names nobody. Without a name or an agency there is no block
  // worth drawing.
  const hasIdentity = Boolean(agent.name || agent.agency);
  if (!hasIdentity && !photo) return null;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {photo ? (
        // Fixed square, cropped rather than stretched, so a portrait of any
        // proportion sits correctly. Empty alt: the name beside it is the
        // information, and "photograph of" read aloud adds nothing a
        // sighted visitor gets from the picture.
        <Image
          src={photo}
          alt=""
          width={48}
          height={48}
          onError={() => setPhotoFailed(true)}
          className="border-alabaster/15 h-12 w-12 shrink-0 border object-cover"
        />
      ) : null}

      {hasIdentity ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-eyebrow text-stone uppercase">Presented by</p>
          {agent.name ? (
            links.website ? (
              <a
                href={links.website}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="link"
                className="text-alabaster hover:text-gold text-sm transition-colors"
              >
                {agent.name}
              </a>
            ) : (
              <p className="text-alabaster text-sm">{agent.name}</p>
            )
          ) : null}
          {agent.agency ? <p className="text-stone text-xs">{agent.agency}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The advisor's portrait on its own, for the contact card — which already
 * sets the name, title and agency in its own type and only needs the face.
 * Renders nothing when unconfigured or when the file fails to load.
 */
export function AgentPortrait({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = CLIENT.links.agentPhoto;
  if (!photo || failed) return null;

  return (
    <Image
      src={photo}
      alt=""
      width={56}
      height={56}
      onError={() => setFailed(true)}
      className={cn('border-alabaster/15 h-14 w-14 shrink-0 border object-cover', className)}
    />
  );
}

/**
 * The client's mark, where one is configured.
 *
 * Height-constrained and set behind a hairline after the AURELIA wordmark.
 * A logo of unknown proportions given free rein is the fastest way to wreck
 * a masthead, and the experience has to look finished without one — so this
 * is a co-sign, not a replacement.
 */
export function ClientLogo({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const { links, agent } = CLIENT;
  if (!links.logo || failed) return null;

  return (
    <Image
      src={links.logo}
      alt={agent.agency ? `${agent.agency} logo` : 'Client logo'}
      width={120}
      height={24}
      onError={() => setFailed(true)}
      className={cn('border-alabaster/15 h-6 w-auto border-l pl-3 opacity-90', className)}
    />
  );
}

export default ClientIdentity;
