import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface SendEmailsButtonProps {
  meetId: string;
  meetName: string;
}

const SendEmailsButton = ({ meetId, meetName }: SendEmailsButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const { toast } = useToast();

  const handleSend = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-meet-emails", {
        body: { meetId },
      });

      if (error) throw error;

      if (data?.success) {
        setResult({ sent: data.sent || 0, failed: data.failed || 0 });
        toast({
          title: `Emails sent!`,
          description: `${data.sent} email(s) delivered successfully.`,
        });
      } else {
        throw new Error(data?.error || "Unknown error");
      }
    } catch (err: any) {
      console.error("Send emails error:", err);
      toast({
        title: "Failed to send emails",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="bg-ocean hover:bg-ocean-dark text-white rounded-xl"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
        ) : result ? (
          <><CheckCircle className="w-4 h-4 mr-2" /> {result.sent} Sent</>
        ) : (
          <><Mail className="w-4 h-4 mr-2" /> Send Emails</>
        )}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Meet Emails?</DialogTitle>
            <DialogDescription>
              This will send personalized event/heat emails to all subscribers for "{meetName}".
              Each parent will receive their swimmer's specific schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSend} className="bg-ocean hover:bg-ocean-dark text-white rounded-xl">
              <Mail className="w-4 h-4 mr-2" /> Send Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendEmailsButton;
