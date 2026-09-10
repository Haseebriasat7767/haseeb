'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/report';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AURELIA]', error);
    // Also to the server, so a failure only this visitor's device produces
    // is not something we find out about from nobody.
    reportClientError({
      kind: 'page-error',
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <Container className="flex min-h-[70svh] flex-col justify-center gap-10 py-40">
      <SectionHeading
        as="h1"
        eyebrow="Interruption"
        title="Something interrupted the experience"
        lede="The page could not be completed. Try again, or return to the entrance."
      />
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button href="/" variant="outline">
          Return home
        </Button>
      </div>
    </Container>
  );
}
