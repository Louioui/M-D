/** STUDIO PBR | CAD WIREFRAME | SPEC LIGHTING. (`?zones` adds a developer zone map.) */
export const INSPECTION_MODES = ['studio', 'cad', 'spec'] as const;
export type InspectionMode = typeof INSPECTION_MODES[number];
