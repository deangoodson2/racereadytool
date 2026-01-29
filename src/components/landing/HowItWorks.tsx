import { Upload, Filter, Eye, Download } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload Your PDF",
    description: "Drag and drop your meet program or browse to select. We support any standard meet sheet format.",
    color: "bg-coral/10 text-coral",
  },
  {
    icon: Filter,
    title: "Select Athletes",
    description: "Choose by athlete name, team, lane assignment, or specific events. Multi-select supported.",
    color: "bg-ocean/10 text-ocean",
  },
  {
    icon: Eye,
    title: "View Schedule",
    description: "See a clean, chronological view of only the events that matter to you. Mobile-friendly.",
    color: "bg-coral/10 text-coral",
  },
  {
    icon: Download,
    title: "Export & Share",
    description: "Download a highlighted PDF, get a shareable link, or email schedules to parents directly.",
    color: "bg-ocean/10 text-ocean",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-sand/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From PDF to personalized schedule in under a minute
          </p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-coral/30 to-ocean/30" />
              )}
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`w-24 h-24 rounded-2xl ${step.color} flex items-center justify-center mb-4 shadow-warm`}>
                  <step.icon className="w-10 h-10" />
                </div>
                
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-white text-sm font-bold mb-3">
                  {index + 1}
                </span>
                
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
