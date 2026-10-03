import LandingTheme from "@/components/landing/LandingTheme";
import AuthModal from "@/components/auth/AuthModal";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import StudyTools from "@/components/landing/StudyTools";
import HowItWorks from "@/components/landing/HowItWorks";
import StudyGroups from "@/components/landing/StudyGroups";
import Footer from "@/components/landing/Footer";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ auth?: string | string[] }>;
}) {
  const { auth } = await searchParams;
  const initialMode = auth === "login" || auth === "signup" || auth === "recovery" ? auth : null;

  return (
    <LandingTheme>
      <AuthModal initialMode={initialMode}>
        <Navbar />
        <main className="flex-1">
          <Hero />
          <StudyTools />
          <HowItWorks />
          <StudyGroups />
        </main>
        <Footer />
      </AuthModal>
    </LandingTheme>
  );
}
