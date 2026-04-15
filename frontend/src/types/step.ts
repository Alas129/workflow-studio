export type StepCategory = 'Requests' | 'Data' | 'Transform' | 'Output' | 'GCP' | 'Assertions' | 'Integrations';

export interface ParameterSchema {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  enum_values?: string[];
  placeholder?: string;
}

export interface StepDefinition {
  type: string;
  label: string;
  category: StepCategory;
  description: string;
  icon: string;
  parameters: ParameterSchema[];
  outputs: string[];
  supports_matrix?: boolean;
  color: string;
}
