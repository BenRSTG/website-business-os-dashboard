-- Milestone 0: Extensions und alle Enum-Typen (docs/03-datenmodell.md, docs/07-datenbankplanung.md)

create extension if not exists pgcrypto with schema extensions;

create type user_role as enum ('owner');

create type lead_industry as enum (
  'maler', 'elektro', 'shk', 'dachdecker', 'garten_landschaft', 'sonstiges'
);
create type lead_status as enum (
  'NEW', 'QUALIFIED', 'DEMO_CREATED', 'CONTACTED', 'INTERESTED',
  'MEETING', 'PROPOSAL', 'WON', 'LOST'
);
create type lead_source as enum (
  'manual', 'google_ads', 'referral', 'cold_call', 'other'
);

create type task_contact_type as enum ('CALL', 'EMAIL', 'DEMO', 'OTHER');
create type task_status as enum ('OPEN', 'DONE', 'SKIPPED');
create type task_result as enum (
  'REACHED', 'NOT_REACHED', 'CALLBACK_SCHEDULED', 'NOT_INTERESTED'
);

create type audit_run_status as enum ('PENDING', 'RUNNING', 'DONE', 'FAILED');
create type audit_actor as enum ('SYSTEM_AI', 'USER');

create type site_package as enum ('STARTER', 'BUSINESS', 'BUSINESS_PLUS');
create type site_style as enum ('modern', 'traditional', 'premium');
create type site_status as enum ('DRAFT', 'PREVIEW', 'LIVE', 'ARCHIVED');
create type domain_status as enum ('NONE', 'PENDING', 'VERIFIED', 'ERROR');
create type page_type as enum (
  'home', 'leistungen', 'ueber_uns', 'kontakt',
  'impressum', 'datenschutz', 'custom'
);

create type care_package as enum ('NONE', 'CARE', 'SEO_CARE', 'GROWTH');
create type customer_status as enum (
  'ONBOARDING', 'IN_PRODUCTION', 'LIVE', 'CHURNED'
);
create type onboarding_status as enum ('OPEN', 'IN_PROGRESS', 'SUBMITTED');
