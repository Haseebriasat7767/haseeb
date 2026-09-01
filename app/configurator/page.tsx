import type { Metadata } from 'next';
import { ConfiguratorPlaceholder } from '@/components/configurator/ConfiguratorPlaceholder';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Residence',
  description:
    'Specify the residence — material palette, glazing, and light. Arriving in the next phase.',
};

export default function ConfiguratorPage() {
  return (
    <>
      <PageHeader
        eyebrow="Residence"
        title="Specify the residence"
        lede="The configurator will let you resolve material, glazing, and light directly
          against the live model."
      />
      <ConfiguratorPlaceholder />
    </>
  );
}
