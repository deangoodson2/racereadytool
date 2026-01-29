import { FileText, Users, Zap, Shield, Smartphone, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Any Meet Format",
    description: "Works with swim meet programs, track meet sheets, and more. Our AI adapts to various PDF layouts.",
    color: "text-coral",
  },
  {
    icon: Users,
    title: "Multi-Athlete Support",
    description: "Filter by individual athletes, entire teams, specific lanes, or event types. Perfect for coaches with multiple swimmers.",
    color: "text-ocean",
  },
  {
    icon: Zap,
    title: "Instant Processing",
    description: "Upload and get results in seconds, not minutes. No more manual highlighting before meets.",
    color: "text-coral",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your PDFs are processed securely and deleted immediately after. We never store your meet data.",
    color: "text-ocean",
  },
  {
    icon: Smartphone,
    title: "Mobile Ready",
    description: "Access your personalized schedule from any device. Perfect for poolside or trackside viewing.",
    color: "text-coral",
  },
  {
    icon: Palette,
    title: "Custom Highlights",
    description: "Choose highlight colors for different athletes or events. Make your exported PDFs truly your own.",
    color: "text-ocean",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built specifically for swim and track coaches who want to spend less time with highlighters
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card 
              key={feature.title}
              className="border-0 shadow-warm hover:shadow-lg transition-all duration-300 rounded-2xl bg-sand/30 hover:bg-white group"
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${feature.color}`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
