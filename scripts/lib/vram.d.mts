export declare const FACE_SIZES: readonly [1024, 1536, 2048];
export type FaceSize = (typeof FACE_SIZES)[number];
export declare function vramPerRoomMiB(face: FaceSize): number;
export declare function peakMiB(
  face: FaceSize,
  limit: number,
  options?: { inFlight?: number; mips?: boolean },
): number;
export declare function resolveFaceSize(raw: string | undefined): FaceSize;
