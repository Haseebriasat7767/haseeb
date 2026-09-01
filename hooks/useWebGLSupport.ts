'use client';

import { useEffect, useState } from 'react';
import { detectWebGL } from '@/lib/three/webgl';

/** `null` while undetermined (SSR / first paint), then a definite answer. */
export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(detectWebGL());
  }, []);

  return supported;
}
