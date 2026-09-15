import LandingTheme from "@/components/landing/LandingTheme";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import StudyTools from "@/components/landing/StudyTools";
import HowItWorks from "@/components/landing/HowItWorks";
import StudyGroups from "@/components/landing/StudyGroups";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <LandingTheme>
      <Navbar />

      <main className="flex-1">
        <Hero />
        <StudyTools />
        <HowItWorks />
        <StudyGroups/>
      </main>


        <Footer />
    
    </LandingTheme>
  );
}