import Hero from "@/components/Hero";
import AboutWade from "@/components/AboutWade";
import ComparisonTable from "@/components/ComparisonTable";
import FunFacts from "@/components/FunFacts";
import ApplicationForm from "@/components/ApplicationForm";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      <Hero />
      <AboutWade />
      <ComparisonTable />
      <FunFacts />
      <ApplicationForm />
      <Footer />
    </main>
  );
}
