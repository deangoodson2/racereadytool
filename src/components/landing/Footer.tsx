import { Link } from "react-router-dom";
import { Calendar, Mail, Twitter, Linkedin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Footer = () => {
  const { toast } = useToast();

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  const handleComingSoon = (e: React.MouseEvent<HTMLAnchorElement>, feature: string) => {
    e.preventDefault();
    toast({
      title: "Coming Soon",
      description: `${feature} page is under construction.`,
    });
  };
  return (
    <footer className="bg-foreground text-white py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-coral rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">MeetSheet</span>
            </Link>
            <p className="text-white/70 text-sm leading-relaxed">
              Transforming meet schedules for coaches and parents. Built by coaches, for coaches.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-white/70">
              <li><Link to="/upload" className="hover:text-white transition-colors">Upload Meet</Link></li>
              <li><a href="#features" onClick={(e) => scrollToSection(e, "features")} className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" onClick={(e) => scrollToSection(e, "pricing")} className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" onClick={(e) => handleComingSoon(e, "Demo")} className="hover:text-white transition-colors">Demo</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-white/70">
              <li><a href="#" onClick={(e) => handleComingSoon(e, "Help Center")} className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="mailto:support@meetsheet.com" className="hover:text-white transition-colors">Contact Us</a></li>
              <li><a href="#" onClick={(e) => handleComingSoon(e, "Status")} className="hover:text-white transition-colors">Status</a></li>
              <li><a href="#" onClick={(e) => handleComingSoon(e, "API Docs")} className="hover:text-white transition-colors">API Docs</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-white/70">
              <li><a href="#" onClick={(e) => handleComingSoon(e, "About")} className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" onClick={(e) => handleComingSoon(e, "Blog")} className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" onClick={(e) => handleComingSoon(e, "Privacy Policy")} className="hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" onClick={(e) => handleComingSoon(e, "Terms of Service")} className="hover:text-white transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/50 text-sm">
            © {new Date().getFullYear()} MeetSheet. All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <a href="mailto:hello@meetsheet.com" className="text-white/50 hover:text-white transition-colors" aria-label="Email">
              <Mail className="w-5 h-5" />
            </a>
            <a 
              href="#" 
              onClick={(e) => handleComingSoon(e, "Twitter")} 
              className="text-white/50 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a 
              href="#" 
              onClick={(e) => handleComingSoon(e, "LinkedIn")} 
              className="text-white/50 hover:text-white transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
