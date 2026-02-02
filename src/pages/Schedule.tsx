import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Search, 
  Filter, 
  MapPin,
  ChevronDown,
  User,
  Users,
  Loader2,
  AlertCircle
} from "lucide-react";
import Header from "@/components/landing/Header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMeet, getLatestMeet, Meet, MeetEvent } from "@/lib/api/meets";

const SchedulePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meetId = searchParams.get("meetId");
  
  const [meet, setMeet] = useState<Meet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>(["All Athletes"]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(["All Teams"]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeet() {
      setLoading(true);
      setError(null);
      
      try {
        let meetData: Meet | null = null;
        
        if (meetId) {
          meetData = await getMeet(meetId);
        } else {
          meetData = await getLatestMeet();
        }
        
        if (!meetData) {
          setError("No meet found. Please upload a meet sheet first.");
        } else {
          setMeet(meetData);
        }
      } catch (err) {
        console.error("Error loading meet:", err);
        setError("Failed to load meet data");
      } finally {
        setLoading(false);
      }
    }
    
    loadMeet();
  }, [meetId]);

  // Extract unique athletes and teams from the meet data
  const { athletes, teams, flattenedEvents } = useMemo(() => {
    if (!meet?.events) {
      return { athletes: ["All Athletes"], teams: ["All Teams"], flattenedEvents: [] };
    }
    
    const athleteSet = new Set<string>();
    const teamSet = new Set<string>();
    const events: Array<{
      id: string;
      sourceEventId: string;
      eventNumber: number | null;
      eventName: string;
      athlete: string;
      team: string;
      heat: number;
      lane: number;
      seedTime: string;
    }> = [];
    
    meet.events.forEach((event) => {
      if (event.athletes && event.athletes.length > 0) {
        event.athletes.forEach((athlete, idx) => {
          if (athlete.name) {
            athleteSet.add(athlete.name);
            if (athlete.team) teamSet.add(athlete.team);
            
            events.push({
              id: `${event.id}-${idx}`,
              sourceEventId: event.id,
              eventNumber: event.eventNumber,
              eventName: event.eventName,
              athlete: athlete.name,
              team: athlete.team || "Unknown",
              heat: athlete.heat || 1,
              lane: athlete.lane || 0,
              seedTime: athlete.seedTime || "",
            });
          }
        });
      } else {
        // Event with no parsed athletes - show the event itself
        events.push({
          id: event.id,
          sourceEventId: event.id,
          eventNumber: event.eventNumber,
          eventName: event.eventName,
          athlete: "See full event",
          team: "Unknown",
          heat: 1,
          lane: 0,
          seedTime: "",
        });
      }
    });
    
    return {
      athletes: ["All Athletes", ...Array.from(athleteSet).sort()],
      teams: ["All Teams", ...Array.from(teamSet).sort()],
      flattenedEvents: events,
    };
  }, [meet]);

  const filteredEvents = flattenedEvents.filter(event => {
    const matchesSearch = event.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          event.athlete.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAthlete = selectedAthletes.includes("All Athletes") || 
                           selectedAthletes.some(a => event.athlete.includes(a));
    
    const matchesTeam = selectedTeams.includes("All Teams") || 
                        selectedTeams.includes(event.team);
    
    return matchesSearch && matchesAthlete && matchesTeam;
  });

  const selectedEvent: MeetEvent | null = useMemo(() => {
    if (!meet || !selectedEventId) return null;
    return meet.events.find((e) => e.id === selectedEventId) || null;
  }, [meet, selectedEventId]);

  const toggleAthlete = (athlete: string) => {
    if (athlete === "All Athletes") {
      setSelectedAthletes(["All Athletes"]);
    } else {
      const newSelection = selectedAthletes.filter(a => a !== "All Athletes");
      if (newSelection.includes(athlete)) {
        const filtered = newSelection.filter(a => a !== athlete);
        setSelectedAthletes(filtered.length ? filtered : ["All Athletes"]);
      } else {
        setSelectedAthletes([...newSelection, athlete]);
      }
    }
  };

  const toggleTeam = (team: string) => {
    if (team === "All Teams") {
      setSelectedTeams(["All Teams"]);
    } else {
      const newSelection = selectedTeams.filter(t => t !== "All Teams");
      if (newSelection.includes(team)) {
        const filtered = newSelection.filter(t => t !== team);
        setSelectedTeams(filtered.length ? filtered : ["All Teams"]);
      } else {
        setSelectedTeams([...newSelection, team]);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sand via-white to-ocean/10">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-ocean animate-spin mb-4" />
            <p className="text-muted-foreground">Loading meet data...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !meet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sand via-white to-ocean/10">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card className="rounded-2xl border-0 shadow-warm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{error || "No meet found"}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Upload a meet sheet to get started
              </p>
              <Button 
                onClick={() => navigate("/upload")}
                className="bg-coral hover:bg-coral-dark text-white rounded-xl"
              >
                Upload Meet Sheet
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand via-white to-ocean/10">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          className="mb-6 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/upload")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Upload New Meet
        </Button>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {meet.fileName.replace('.pdf', '')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date(meet.createdAt).toLocaleDateString()} • {meet.events.length} events parsed
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl border-ocean/30">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button className="bg-coral hover:bg-coral-dark text-white rounded-xl">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl shadow-warm border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events or athletes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl border-border/50"
                />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-border/50">
                    <User className="w-4 h-4 mr-2" />
                    Athletes ({athletes.length - 1})
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 max-h-60 overflow-auto">
                  {athletes.map((athlete) => (
                    <DropdownMenuCheckboxItem
                      key={athlete}
                      checked={selectedAthletes.includes(athlete)}
                      onCheckedChange={() => toggleAthlete(athlete)}
                    >
                      {athlete}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-border/50">
                    <Users className="w-4 h-4 mr-2" />
                    Teams ({teams.length - 1})
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 max-h-60 overflow-auto">
                  {teams.map((team) => (
                    <DropdownMenuCheckboxItem
                      key={team}
                      checked={selectedTeams.includes(team)}
                      onCheckedChange={() => toggleTeam(team)}
                    >
                      {team}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Active Filters */}
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedAthletes.filter(a => a !== "All Athletes").map((athlete) => (
                <Badge 
                  key={athlete} 
                  variant="secondary" 
                  className="bg-coral/10 text-coral hover:bg-coral/20 cursor-pointer"
                  onClick={() => toggleAthlete(athlete)}
                >
                  {athlete} ×
                </Badge>
              ))}
              {selectedTeams.filter(t => t !== "All Teams").map((team) => (
                <Badge 
                  key={team} 
                  variant="secondary" 
                  className="bg-ocean/10 text-ocean hover:bg-ocean/20 cursor-pointer"
                  onClick={() => toggleTeam(team)}
                >
                  {team} ×
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredEvents.length}</span> entries
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Filter className="w-4 h-4 mr-1" />
            Sort by Event
          </Button>
        </div>

        {/* Events List */}
        <div className="space-y-3">
          {filteredEvents.map((event, index) => (
            <Card 
              key={event.id}
              className={`rounded-xl border-0 shadow-warm hover:shadow-lg transition-all duration-300 ${
                index === 0 ? 'border-l-4 border-l-coral bg-coral/5' : 'bg-white'
              }`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEventId(event.sourceEventId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedEventId(event.sourceEventId);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className={`text-center min-w-[50px] ${index === 0 ? 'text-coral' : 'text-muted-foreground'}`}>
                      {event.eventNumber && (
                        <>
                          <p className="font-mono text-lg font-semibold">#{event.eventNumber}</p>
                        </>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-foreground">{event.eventName}</h3>
                      <p className="text-sm text-muted-foreground">{event.athlete}</p>
                      {event.team !== "Unknown" && (
                        <p className="text-xs text-muted-foreground">{event.team}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-[66px] md:ml-0">
                    {event.heat > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Heat {event.heat}
                      </Badge>
                    )}
                    {event.lane > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Lane {event.lane}
                      </Badge>
                    )}
                    {event.seedTime && (
                      <Badge variant="secondary" className="text-xs bg-sand">
                        {event.seedTime}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={!!selectedEvent} onOpenChange={(open) => (!open ? setSelectedEventId(null) : undefined)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedEvent?.eventNumber ? `Event #${selectedEvent.eventNumber}: ` : "Event: "}
                {selectedEvent?.eventName}
              </DialogTitle>
            </DialogHeader>

            {selectedEvent?.athletes?.length ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {selectedEvent.athletes.length} athletes
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="p-3 font-medium">Athlete</th>
                        <th className="p-3 font-medium">Team</th>
                        <th className="p-3 font-medium">Heat</th>
                        <th className="p-3 font-medium">Lane</th>
                        <th className="p-3 font-medium">Seed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEvent.athletes.map((a, idx) => (
                        <tr key={`${a.name}-${idx}`} className="border-t border-border/50">
                          <td className="p-3 font-medium text-foreground">{a.name}</td>
                          <td className="p-3 text-muted-foreground">{a.team || "—"}</td>
                          <td className="p-3 text-muted-foreground">{a.heat ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{a.lane ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{a.seedTime || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No athletes were parsed for this event yet.
              </div>
            )}
          </DialogContent>
        </Dialog>

        {filteredEvents.length === 0 && (
          <Card className="rounded-2xl border-0 shadow-warm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No events found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search query
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SchedulePage;
