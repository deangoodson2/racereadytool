import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/landing/Header";

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

const UploadPage = () => {
  const navigate = useNavigate();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const simulateUpload = async (file: File) => {
    setFileName(file.name);
    setUploadState("uploading");
    setProgress(0);

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setProgress(i);
    }

    setUploadState("processing");
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setUploadState("success");
    
    // Navigate to schedule view after a brief delay
    setTimeout(() => {
      navigate("/schedule");
    }, 1000);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file");
        setUploadState("error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be under 10MB");
        setUploadState("error");
        return;
      }
      simulateUpload(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const resetUpload = () => {
    setUploadState("idle");
    setProgress(0);
    setFileName("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand via-white to-ocean/10">
      <Header />
      
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Button 
          variant="ghost" 
          className="mb-6 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Upload Your Meet Sheet
          </h1>
          <p className="text-muted-foreground">
            Drag and drop your meet PDF or click to browse
          </p>
        </div>

        <Card className="rounded-2xl shadow-warm border-0">
          <CardContent className="p-8">
            {uploadState === "idle" && (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive 
                    ? "border-coral bg-coral/5" 
                    : "border-border hover:border-ocean hover:bg-ocean/5"
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-coral/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-coral" />
                </div>
                
                {isDragActive ? (
                  <p className="text-coral font-medium">Drop your PDF here...</p>
                ) : (
                  <>
                    <p className="text-foreground font-medium mb-2">
                      Drag & drop your meet PDF here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse files
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports PDF files up to 10MB
                    </p>
                  </>
                )}
              </div>
            )}

            {(uploadState === "uploading" || uploadState === "processing") && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-ocean/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {uploadState === "uploading" ? (
                    <FileText className="w-8 h-8 text-ocean" />
                  ) : (
                    <Loader2 className="w-8 h-8 text-ocean animate-spin" />
                  )}
                </div>
                
                <p className="font-medium text-foreground mb-2">{fileName}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {uploadState === "uploading" ? "Uploading..." : "Processing your meet sheet..."}
                </p>
                
                <Progress value={uploadState === "processing" ? 100 : progress} className="max-w-xs mx-auto" />
              </div>
            )}

            {uploadState === "success" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-ocean/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-ocean" />
                </div>
                
                <p className="font-medium text-foreground mb-2">Upload Complete!</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to your personalized schedule...
                </p>
              </div>
            )}

            {uploadState === "error" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                
                <p className="font-medium text-foreground mb-2">Upload Failed</p>
                <p className="text-sm text-destructive mb-4">{error}</p>
                
                <Button 
                  onClick={resetUpload}
                  className="bg-coral hover:bg-coral-dark text-white rounded-xl"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Supported formats: Swim meet programs, Track meet sheets
          </p>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span>🏊 HyTek Meet Manager</span>
            <span>🏃 DirectAthletics</span>
            <span>📄 Custom PDFs</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
