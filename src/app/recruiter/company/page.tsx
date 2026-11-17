import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireEmployer } from "@/lib/auth/employer";
import { AppHeader } from "@/components/app/app-header";
import { CompanyForm } from "@/components/recruiter/company-form";

export const metadata: Metadata = { title: "Your company · CareerIO" };

export default function CompanyPage() {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <Company />
      </Suspense>
    </div>
  );
}

async function Company() {
  await connection();
  const session = await requireEmployer("/recruiter/company");
  const { supabase, user, fullName, company } = session;
  const { data } = await supabase.from("companies").select("id, name, industry, size, website, location, description, logo_path").eq("id", company.id).maybeSingle();

  return (
    <>
      <AppHeader name={fullName} active="company" role="employer" />
      <CompanyForm
        userId={user.id}
        companyId={company.id}
        initial={{
          name: data?.name ?? company.name,
          industry: data?.industry ?? "",
          size: (data?.size ?? "") as string,
          website: data?.website ?? "",
          location: data?.location ?? "",
          description: data?.description ?? "",
        }}
        logoPath={data?.logo_path ?? null}
      />
    </>
  );
}
