export interface PresetParameter {
  step_type: string;
  param_name: string;
  value: unknown;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  parameters: PresetParameter[];
}
