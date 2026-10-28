import type {
  LeadIndustry,
  LeadSource,
  LeadStatus,
  TaskContactType,
  TaskResult,
} from "./constants";

export interface Lead {
  id: string;
  organization_id: string;
  company_name: string;
  industry: LeadIndustry;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  existing_website_url: string | null;
  google_profile_url: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  status: LeadStatus;
  source: LeadSource;
  next_contact_at: string | null;
  notes: string | null;
  reactivated_at: string | null;
  reactivation_count: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  due_at: string | null;
  contact_type: TaskContactType;
  status: "OPEN" | "DONE" | "SKIPPED";
  result: TaskResult | null;
  note: string | null;
  created_at: string;
  completed_at: string | null;
}

export type TaskWithLead = Task & {
  lead: { id: string; company_name: string } | null;
};

export interface ActivityEntry {
  id: string;
  action_type: string;
  entity_id: string;
  input: { company_name?: string; from?: LeadStatus; to?: LeadStatus } | null;
  created_at: string;
}
