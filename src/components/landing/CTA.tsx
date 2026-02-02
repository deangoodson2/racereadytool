import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const CTA = () => {
  const { toast } = useToast();

  const handleWatchDemo = () => {
    toast({
      title: "Demo Video Coming Soon",
      description: "We're working on a video walkthrough. Try uploading a meet PDF to see RaceReady in action!",
    });
  };
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-coral/10 via-sand to-ocean/10">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-coral mb-6 shadow-warm">
          <Sparkles className="w-4 h-4" />
          Ready to save time at your next meet?
        </div>
        
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          Stop highlighting.
          <br />
          <span className="text-coral">Start coaching.</span>
        </h2>
        
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Upload your first meet sheet in seconds and see the magic happen. 
          No credit card required for your free trial.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/upload">
            <Button size="lg" className="bg-coral hover:bg-coral-dark text-white px-8 py-6 text-lg rounded-xl shadow-soft hover:shadow-warm transition-all duration-300">
              Try RaceReady Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="lg" 
            className="px-8 py-6 text-lg rounded-xl border-2 border-ocean/30 hover:bg-ocean/10"
            onClick={handleWatchDemo}
          >
            Watch Demo
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-6">
          Trusted by 500+ swim and track coaches nationwide
        </p>
      </div>
    </section>
  );
};

export default CTA;
