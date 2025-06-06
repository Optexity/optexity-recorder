export interface Locator {
  locator_type: string;
  first_arg: string;
  options: Record<string, any>;
  fixed: boolean;
}

export interface ClickElementAction {
  index: number;
  xpath: string | null;
  double_click: boolean;
  locators: Locator[];
  command: string | null;
  action_description: string | null;
}

export interface InputTextAction {
  index: number;
  text: string;
  xpath: string | null;
  locators: Locator[];
  fixed: boolean | null;
  command: string | null;
  fill_value_name: string | null;
  action_description: string | null;
}

export interface DoneAction {
  text: string;
  success: boolean;
}

export interface NextStepResponse {
  step_number: number;
  demonstration_goal: string;
  next_action: ClickElementAction | InputTextAction | DoneAction;
  next_action_name: "ClickElementAction" | "InputTextAction" | "DoneAction";
}

export interface Demonstration {
  demonstration_id: string;
  user_id: string;
  url: string;
  goal: string;
  recorded_demo_filename: string;
  actions: (ClickElementAction | InputTextAction | DoneAction)[];
  embedding: number[];
  created_at: string | null;
  updated_at: string | null;
}
