import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { GraderShowcase } from "@/components/landing/grader-showcase";
import { MatchingShowcase } from "@/components/landing/matching-showcase";
import { Employers } from "@/components/landing/employers";
import { Trust } from "@/components/landing/trust";
import { Faq } from "@/components/landing/faq";
import { Fields, FinalCta, Footer } from "@/components/landing/cta-footer";
import { PageTransition } from "@/components/page-transition";

export default function Home() {
  return (
    <PageTransition className="">
      <Nav />
      <main>
        <Hero />
        <Fields />
        <HowItWorks />
        <GraderShowcase />
        <MatchingShowcase />
        <Employers />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </PageTransition>
  );
}
