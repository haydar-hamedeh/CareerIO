import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { GraderShowcase } from "@/components/landing/grader-showcase";
import { MatchingShowcase } from "@/components/landing/matching-showcase";
import { Employers } from "@/components/landing/employers";
import { Trust } from "@/components/landing/trust";
import { Faq } from "@/components/landing/faq";
import { Fields, FinalCta, Footer } from "@/components/landing/cta-footer";

export default function Home() {
  return (
    <>
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
    </>
  );
}
