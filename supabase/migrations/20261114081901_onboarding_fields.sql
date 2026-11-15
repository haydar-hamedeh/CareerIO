-- Onboarding: phone and country for candidates. Phone is contact data only and is
-- never used in grading or matching. Candidates may edit their profile fields but
-- not their embedding (that is written by the server for matching).

alter table public.candidate_profiles
  add column phone text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  add column country text check (char_length(country) <= 80);

revoke update on public.candidate_profiles from authenticated;
grant update (
  headline, summary, location, country, phone, years_experience, education, experience,
  skills, languages, desired_roles, work_modes, preferred_locations, seniority,
  salary_min, salary_max, salary_currency
) on public.candidate_profiles to authenticated;
