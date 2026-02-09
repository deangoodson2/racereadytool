import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, User, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriberFormProps {
  meetId: string;
}

const SubscriberForm = ({ meetId }: SubscriberFormProps) => {
  const [email, setEmail] = useState("");
  const [swimmerName, setSwimmerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedName = swimmerName.trim();

    if (!trimmedEmail || !trimmedName) {
      toast({ title: "Please fill in both fields", variant: "destructive" });
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }

    if (trimmedName.length > 100 || trimmedEmail.length > 255) {
      toast({ title: "Input too long", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("meet_subscribers").insert({
        meet_id: meetId,
        email: trimmedEmail,
        swimmer_name: trimmedName,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "You're already subscribed for this swimmer!" });
        } else {
          throw error;
        }
      } else {
        setSuccess(true);
        setEmail("");
        setSwimmerName("");
        toast({ title: "Subscribed! You'll get an email when the meet is ready." });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error("Subscribe error:", err);
      toast({ title: "Failed to subscribe", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl border-0 shadow-warm bg-gradient-to-r from-ocean/5 to-coral/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-ocean" />
          <h3 className="font-semibold text-foreground">Get Notified</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your email and swimmer's name to receive their events and heats.
        </p>
        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Swimmer's name"
              value={swimmerName}
              onChange={(e) => setSwimmerName(e.target.value)}
              className="pl-10 rounded-xl border-border/50"
              maxLength={100}
              disabled={loading}
            />
          </div>
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 rounded-xl border-border/50"
              maxLength={255}
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-ocean hover:bg-ocean-dark text-white rounded-xl whitespace-nowrap"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : success ? (
              <><CheckCircle className="w-4 h-4 mr-1" /> Subscribed</>
            ) : (
              "Subscribe"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SubscriberForm;
