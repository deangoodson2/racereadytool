import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for trying MeetSheet",
    features: [
      "3 meet uploads per month",
      "Basic athlete filtering",
      "Digital schedule view",
      "Ad-supported experience",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Coach",
    price: "$9",
    period: "/month",
    description: "For individual coaches",
    features: [
      "Unlimited meet uploads",
      "Advanced filtering options",
      "Highlighted PDF downloads",
      "Ad-free experience",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    description: "For entire coaching staffs",
    features: [
      "Everything in Coach",
      "Unlimited team members",
      "Auto-email to parents",
      "Team branding on exports",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const Pricing = () => {
  const { toast } = useToast();

  const handleContactSales = () => {
    toast({
      title: "Contact Sales",
      description: "Email us at sales@meetsheet.com for team pricing inquiries.",
    });
  };

  return (
    <section id="pricing" className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you're ready. No hidden fees, cancel anytime.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative rounded-2xl transition-all duration-300 hover:shadow-warm ${
                plan.popular 
                  ? 'border-2 border-coral shadow-warm scale-105' 
                  : 'border border-border hover:border-ocean/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-coral text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Most Popular
                </div>
              )}
              
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                
                <ul className="space-y-3 text-left">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-ocean shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                {plan.cta === "Contact Sales" ? (
                  <Button 
                    className="w-full rounded-xl py-6 bg-secondary hover:bg-secondary/80"
                    onClick={handleContactSales}
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Link to="/upload" className="w-full">
                    <Button 
                      className={`w-full rounded-xl py-6 ${
                        plan.popular 
                          ? 'bg-coral hover:bg-coral-dark text-white' 
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
