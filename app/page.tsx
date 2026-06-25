import Hero from "@/components/Hero";
import AboutWade from "@/components/AboutWade";
import FunFacts from "@/components/FunFacts";
import ApplicationForm from "@/components/ApplicationForm";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <Hero />
      <AboutWade />
      <FunFacts />
      <ApplicationForm />
      <Footer />
    </main>
  );
}
