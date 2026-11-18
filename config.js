// Settings for the configurator. The 3D model is in models/plant.glb.
export const MODEL_URL = 'models/plant.glb';
export const M_PER_UNIT = 0.05;   // the model has no real-world size: 1 model unit = 0.05 m. Change this to match your real size.
export const GAP = 15;            // space between units, in model units
export const MAX_PER_TYPE = 5;    // most units of one kind a person can add
export const MIN_TOTAL = 1;       // the machine always keeps at least one unit

// node = object name inside the GLB
export const UNITS = {
  tower:     { label: 'Tower unit',     node: 'unit_tower' },
  vessel:    { label: 'Vessel unit',    node: 'unit_vessel' },
  condenser: { label: 'Condenser unit', node: 'unit_condenser' },
};
export const DEFAULT_ORDER = ['tower', 'vessel', 'condenser'];
export const GROUPS = [{ title: 'Process units', types: ['tower', 'vessel', 'condenser'] }];

// null = keep the model's original look
export const COLORS = [null, '#4f7cac', '#c8102e', '#2f7d5b', '#d9a21b', '#5b6670', '#eef1f3'];
