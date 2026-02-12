import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Highlighter, Download, FileText, ChevronDown, Palette, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MeetEvent } from "@/lib/api/meets";

interface CoachToolsProps {
  meetId: string;
  fileUrl: string | null;
  events: MeetEvent[];
  teams: string[];
}

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#FFFF00" },
  { name: "Green", value: "#90EE90" },
  { name: "Blue", value: "#87CEEB" },
  { name: "Pink", value: "#FFB6C1" },
  { name: "Orange", value: "#FFD699" },
];

const HIGHLIGHT_STYLES = [
  { name: "Row Highlight", value: "row" },
  { name: "Name Only", value: "name" },
  { name: "Margin Markers", value: "margin" },
];

const CoachTools = ({ meetId, fileUrl, events, teams }: CoachToolsProps) => {
  const { toast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedLanes, setSelectedLanes] = useState<number[]>([]);
  const [highlightColor, setHighlightColor] = useState("#FFFF00");
  const [highlightStyle, setHighlightStyle] = useState("row");
  const [loadingHighlight, setLoadingHighlight] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Determine available lanes from the events data
  const availableLanes = useMemo(() => {
    const laneSet = new Set<number>();
    events.forEach((event) => {
      event.athletes?.forEach((a) => {
        if (a.lane && a.lane > 0) laneSet.add(a.lane);
      });
    });
    return Array.from(laneSet).sort((a, b) => a - b);
  }, [events]);

  const toggleLane = (lane: number) => {
    setSelectedLanes((prev) =>
      prev.includes(lane) ? prev.filter((l) => l !== lane) : [...prev, lane].sort((a, b) => a - b)
    );
  };

  const canGenerate = selectedTeam && selectedLanes.length > 0;

  const handleDownloadHighlightedPdf = async () => {
    if (!canGenerate || !fileUrl) {
      toast({ title: "Missing info", description: "Select a team and lanes, and ensure the PDF is available.", variant: "destructive" });
      return;
    }

    setLoadingHighlight(true);
    try {
      const { data, error } = await supabase.functions.invoke("highlight-meet-pdf", {
        body: { meetId, team: selectedTeam, lanes: selectedLanes, color: highlightColor, style: highlightStyle },
      });

      if (error) throw error;
      if (!data?.pdfBase64) throw new Error("No PDF returned");

      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `highlighted-${selectedTeam}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Downloaded!", description: "Highlighted PDF saved." });
    } catch (err: any) {
      console.error("Highlight PDF error:", err);
      toast({ title: "Error", description: err.message || "Failed to generate highlighted PDF", variant: "destructive" });
    } finally {
      setLoadingHighlight(false);
    }
  };

  const handleDownloadSummary = async () => {
    if (!canGenerate) {
      toast({ title: "Missing info", description: "Select a team and lanes first.", variant: "destructive" });
      return;
    }

    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-summary-pdf", {
        body: { meetId, team: selectedTeam, lanes: selectedLanes },
      });

      if (error) throw error;
      if (!data?.pdfBase64) throw new Error("No PDF returned");

      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `summary-${selectedTeam}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Downloaded!", description: "Summary PDF saved." });
    } catch (err: any) {
      console.error("Summary PDF error:", err);
      toast({ title: "Error", description: err.message || "Failed to generate summary PDF", variant: "destructive" });
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-warm border-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Highlighter className="w-5 h-5 text-coral" />
          <h2 className="text-lg font-semibold text-foreground">Coach Tools</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Team Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Team</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select your team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lane Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Lanes</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between rounded-xl">
                  {selectedLanes.length > 0
                    ? `Lanes ${selectedLanes.join(", ")}`
                    : "Select lanes"}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 max-h-60 overflow-auto">
                {availableLanes.map((lane) => (
                  <DropdownMenuCheckboxItem
                    key={lane}
                    checked={selectedLanes.includes(lane)}
                    onCheckedChange={() => toggleLane(lane)}
                  >
                    Lane {lane}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Highlight Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Highlight Color</Label>
            <div className="flex gap-2">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setHighlightColor(c.value)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    highlightColor === c.value
                      ? "border-foreground scale-110 shadow-md"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Highlight Style */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Highlight Style</Label>
            <Select value={highlightStyle} onValueChange={setHighlightStyle}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIGHLIGHT_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Filters Preview */}
        {(selectedTeam || selectedLanes.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedTeam && (
              <Badge className="bg-ocean/10 text-ocean">{selectedTeam}</Badge>
            )}
            {selectedLanes.map((lane) => (
              <Badge
                key={lane}
                variant="secondary"
                className="bg-coral/10 text-coral cursor-pointer hover:bg-coral/20"
                onClick={() => toggleLane(lane)}
              >
                Lane {lane} ×
              </Badge>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleDownloadHighlightedPdf}
            disabled={!canGenerate || loadingHighlight || !fileUrl}
            className="bg-coral hover:bg-coral-dark text-white rounded-xl flex-1"
          >
            {loadingHighlight ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Highlighter className="w-4 h-4 mr-2" />
            )}
            Download Highlighted PDF
          </Button>
          <Button
            onClick={handleDownloadSummary}
            disabled={!canGenerate || loadingSummary}
            variant="outline"
            className="rounded-xl border-ocean/30 flex-1"
          >
            {loadingSummary ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Download Summary PDF
          </Button>
        </div>

        {!fileUrl && (
          <p className="text-xs text-muted-foreground mt-2">
            Highlighted PDF unavailable — original file not found in storage.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CoachTools;
