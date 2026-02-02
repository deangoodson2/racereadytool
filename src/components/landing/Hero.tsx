import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Users, FileCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Hero = () => {
  const { toast } = useToast();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDemoAction = (action: string) => {
    toast({
      title: `${action} - Demo`,
      description: "This feature will be available once you upload a real meet PDF.",
    });
  };
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-sand via-white to-ocean/10 py-20 px-4">
      {/* Background decoration */}
      <div className="absolute top-20 right-0 w-96 h-96 bg-coral/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-ocean/10 rounded-full blur-3xl" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-ocean mb-6 shadow-warm">
              <span className="w-2 h-2 bg-ocean rounded-full animate-pulse" />
              For swim & track coaches
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Your meet sheet,
              <br />
              <span className="text-coral">instantly personalized</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
              Upload any meet PDF and see only the events that matter to you. No more manual highlighting. No more missed races.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link to="/upload">
                <Button size="lg" className="bg-coral hover:bg-coral-dark text-white px-8 py-6 text-lg rounded-xl shadow-soft hover:shadow-warm transition-all duration-300">
                  Upload Meet PDF
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 py-6 text-lg rounded-xl border-2 border-ocean/40 hover:bg-ocean-light/50 hover:border-ocean"
                onClick={() => scrollToSection("how-it-works")}
              >
                See How It Works
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-ocean" />
                <span>Results in seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-ocean" />
                <span>500+ coaches</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-ocean" />
                <span>Free to try</span>
              </div>
            </div>
          </div>
          
          {/* Mock Schedule Preview */}
          <div className="relative animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="bg-white rounded-2xl shadow-warm p-6 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Sarah's Events</h3>
                <span className="text-xs bg-ocean/10 text-ocean px-3 py-1 rounded-full">
                  5 events today
                </span>
              </div>
              
              <div className="space-y-3">
                {[
                  { time: "9:15 AM", event: "50 Free", heat: "Heat 3", lane: "Lane 4" },
                  { time: "10:30 AM", event: "100 Fly", heat: "Heat 2", lane: "Lane 5" },
                  { time: "11:45 AM", event: "200 IM", heat: "Heat 1", lane: "Lane 3" },
                  { time: "1:00 PM", event: "100 Free", heat: "Heat 4", lane: "Lane 4" },
                  { time: "2:30 PM", event: "4x100 Relay", heat: "Heat 2", lane: "Lane 6" },
                ].map((item, i) => (
                  <div 
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      i === 0 ? 'bg-coral/10 border-l-4 border-coral' : 'bg-sand/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-sm ${i === 0 ? 'text-coral font-semibold' : 'text-muted-foreground'}`}>
                        {item.time}
                      </span>
                      <span className={`font-medium ${i === 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                        {item.event}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="bg-white px-2 py-1 rounded">{item.heat}</span>
                      <span className="bg-white px-2 py-1 rounded">{item.lane}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-coral hover:bg-coral-dark text-white rounded-lg"
                  onClick={() => handleDemoAction("Download PDF")}
                >
                  Download PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 rounded-lg border-ocean/30"
                  onClick={() => handleDemoAction("Share Link")}
                >
                  Share Link
                </Button>
              </div>
            </div>
            
            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-ocean text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg animate-float">
              ✨ Auto-highlighted
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
