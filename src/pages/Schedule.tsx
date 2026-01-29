import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Clock, 
  MapPin,
  ChevronDown,
  User,
  Users
} from "lucide-react";
import Header from "@/components/landing/Header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data representing parsed meet events
const mockEvents = [
  { id: 1, time: "9:00 AM", event: "50 Yard Freestyle", heat: 3, lane: 4, athlete: "Sarah Johnson", team: "Dolphins", location: "Pool A" },
  { id: 2, time: "9:15 AM", event: "100 Yard Backstroke", heat: 2, lane: 5, athlete: "Mike Chen", team: "Dolphins", location: "Pool A" },
  { id: 3, time: "9:30 AM", event: "50 Yard Butterfly", heat: 1, lane: 3, athlete: "Sarah Johnson", team: "Dolphins", location: "Pool A" },
  { id: 4, time: "10:00 AM", event: "200 Yard IM", heat: 4, lane: 6, athlete: "Emma Wilson", team: "Sharks", location: "Pool B" },
  { id: 5, time: "10:30 AM", event: "100 Yard Freestyle", heat: 2, lane: 4, athlete: "Sarah Johnson", team: "Dolphins", location: "Pool A" },
  { id: 6, time: "11:00 AM", event: "50 Yard Breaststroke", heat: 3, lane: 2, athlete: "Mike Chen", team: "Dolphins", location: "Pool A" },
  { id: 7, time: "11:30 AM", event: "100 Yard Butterfly", heat: 1, lane: 5, athlete: "Jake Thompson", team: "Sharks", location: "Pool B" },
  { id: 8, time: "12:00 PM", event: "200 Yard Freestyle", heat: 2, lane: 3, athlete: "Emma Wilson", team: "Sharks", location: "Pool B" },
  { id: 9, time: "1:00 PM", event: "4x100 Relay", heat: 1, lane: 4, athlete: "Dolphins Team", team: "Dolphins", location: "Pool A" },
  { id: 10, time: "1:30 PM", event: "4x50 Medley Relay", heat: 2, lane: 5, athlete: "Sharks Team", team: "Sharks", location: "Pool B" },
];

const athletes = ["All Athletes", "Sarah Johnson", "Mike Chen", "Emma Wilson", "Jake Thompson"];
const teams = ["All Teams", "Dolphins", "Sharks"];

const SchedulePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>(["Sarah Johnson"]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(["Dolphins"]);

  const filteredEvents = mockEvents.filter(event => {
    const matchesSearch = event.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          event.athlete.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAthlete = selectedAthletes.includes("All Athletes") || 
                           selectedAthletes.some(a => event.athlete.includes(a));
    
    const matchesTeam = selectedTeams.includes("All Teams") || 
                        selectedTeams.includes(event.team);
    
    return matchesSearch && matchesAthlete && matchesTeam;
  });

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
              Regional Championship 2024
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              January 29, 2026 • Aquatic Center
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
                    Athletes
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
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
                    Teams
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
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
            Showing <span className="font-medium text-foreground">{filteredEvents.length}</span> events
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Filter className="w-4 h-4 mr-1" />
            Sort by Time
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
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className={`text-center min-w-[60px] ${index === 0 ? 'text-coral' : 'text-muted-foreground'}`}>
                      <p className="font-mono text-lg font-semibold">{event.time.split(' ')[0]}</p>
                      <p className="text-xs">{event.time.split(' ')[1]}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-foreground">{event.event}</h3>
                      <p className="text-sm text-muted-foreground">{event.athlete}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-[76px] md:ml-0">
                    <Badge variant="outline" className="text-xs">
                      Heat {event.heat}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Lane {event.lane}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-sand">
                      <MapPin className="w-3 h-3 mr-1" />
                      {event.location}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
