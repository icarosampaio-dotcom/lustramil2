import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Upload as UploadIcon,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowLeft,
  Camera,
  X,
  Files,
} from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";

interface FileItem {
  file: File;
  id: string;
  status: "pending" | "processing" | "success" | "error";
  result?: any;
  error?: string;
}

export default function UploadPage() {
  return (
    <DashboardLayout>
      <UploadContent />
    </DashboardLayout>
  );
}

function UploadContent() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialType = params.get("type") as "entrada" | "saida" | null;

  const [, setLocation] = useLocation();
  const [type, setType] = useState<"entrada" | "saida">(initialType || "entrada");
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const capturedFile = e.target.files?.[0];
    if (capturedFile) {
      addFiles([capturedFile]);
    }
  }, []);

  const uploadMutation = trpc.invoices.upload.useMutation();
  const utils = trpc.useUtils();

  const acceptedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/xml",
    "text/xml",
  ];

  const isValidFile = (f: File): boolean => {
    const isXml = f.name.toLowerCase().endsWith(".xml");
    if (!acceptedTypes.includes(f.type) && !isXml) return false;
    if (f.size > 15 * 1024 * 1024) return false;
    return true;
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles: FileItem[] = [];
    let rejected = 0;

    for (const f of newFiles) {
      if (isValidFile(f)) {
        validFiles.push({
          file: f,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: "pending",
        });
      } else {
        rejected++;
      }
    }

    if (rejected > 0) {
      toast.error(`${rejected} arquivo(s) rejeitado(s). Use XML, PDF, JPG, PNG ou imagem (máx. 15MB).`);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setAllDone(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    // Reset input so same files can be selected again
    if (e.target) e.target.value = "";
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processAllFiles = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setAllDone(false);

    const pendingFiles = files.filter(f => f.status === "pending" || f.status === "error");

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileItem = pendingFiles[i];
      setCurrentIndex(files.findIndex(f => f.id === fileItem.id));

      // Mark as processing
      setFiles(prev => prev.map(f =>
        f.id === fileItem.id ? { ...f, status: "processing" as const } : f
      ));

      try {
        const base64 = await fileToBase64(fileItem.file);
        const response = await uploadMutation.mutateAsync({
          type,
          fileBase64: base64,
          fileName: fileItem.file.name,
          fileType: fileItem.file.type || (fileItem.file.name.endsWith(".xml") ? "application/xml" : "application/octet-stream"),
        });

        setFiles(prev => prev.map(f =>
          f.id === fileItem.id ? { ...f, status: "success" as const, result: response } : f
        ));
      } catch (err: any) {
        const message = err?.message || "Erro ao processar";
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id ? { ...f, status: "error" as const, error: message } : f
        ));
      }
    }

    // Invalidate all dashboard data
    utils.dashboard.stats.invalidate();
    utils.dashboard.recentMovements.invalidate();
    utils.dashboard.lowStock.invalidate();
    utils.products.list.invalidate();
    utils.invoices.list.invalidate();

    setProcessing(false);
    setCurrentIndex(-1);
    setAllDone(true);

    const successCount = files.filter(f => f.status === "success").length + pendingFiles.filter(f => {
      const updated = files.find(ff => ff.id === f.id);
      return updated?.status === "success";
    }).length;

    toast.success("Processamento concluído!");
  };

  const resetForm = () => {
    setFiles([]);
    setAllDone(false);
    setCurrentIndex(-1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const pendingCount = files.filter(f => f.status === "pending").length;
  const processingCount = files.filter(f => f.status === "processing").length;
  const progressPercent = files.length > 0
    ? Math.round(((successCount + errorCount) / files.length) * 100)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nova Movimentação</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Faça upload de uma ou várias notas fiscais para processamento automático
          </p>
        </div>
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { if (!processing) { setType("entrada"); resetForm(); } }}
          className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
            type === "entrada"
              ? "border-emerald-500 bg-emerald-50 shadow-md"
              : "border-border hover:border-emerald-200 hover:bg-emerald-50/30"
          } ${processing ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            type === "entrada" ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
          }`}>
            <ArrowDownToLine className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className={`font-semibold ${type === "entrada" ? "text-emerald-700" : ""}`}>Entrada</p>
            <p className="text-xs text-muted-foreground">Compra / Recebimento</p>
          </div>
        </button>

        <button
          onClick={() => { if (!processing) { setType("saida"); resetForm(); } }}
          className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
            type === "saida"
              ? "border-orange-500 bg-orange-50 shadow-md"
              : "border-border hover:border-orange-200 hover:bg-orange-50/30"
          } ${processing ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            type === "saida" ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
          }`}>
            <ArrowUpFromLine className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className={`font-semibold ${type === "saida" ? "text-orange-700" : ""}`}>Saída</p>
            <p className="text-xs text-muted-foreground">Venda / Expedição</p>
          </div>
        </button>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !processing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
              processing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            } ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : files.length > 0 && !allDone
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff"
              onChange={handleFileSelect}
              className="hidden"
              multiple
              disabled={processing}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="hidden"
            />

            <div className="space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                {files.length > 0 ? (
                  <Files className="h-7 w-7 text-emerald-600" />
                ) : (
                  <UploadIcon className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {files.length > 0
                    ? `${files.length} arquivo(s) selecionado(s) — arraste mais para adicionar`
                    : isMobile
                      ? "Toque para selecionar arquivos"
                      : "Arraste os arquivos aqui ou clique para selecionar"
                  }
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  XML (NF-e), PDF, JPG, PNG e outros formatos (máx. 15MB cada) — selecione vários de uma vez
                </p>
              </div>
            </div>
          </div>

          {/* Botão de Câmera - visível em dispositivos móveis */}
          {isMobile && !processing && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              variant="outline"
              className="w-full mt-3 gap-2 h-12 text-base border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
              size="lg"
            >
              <Camera className="h-5 w-5 text-primary" />
              <span>Tirar Foto da Nota Fiscal</span>
            </Button>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              {/* Progress bar during processing */}
              {processing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processando...</span>
                    <span className="font-medium">{successCount + errorCount} de {files.length}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}

              {/* Summary when done */}
              {allDone && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-emerald-800">Processamento concluído!</p>
                    <p className="text-sm text-emerald-600">
                      {successCount} nota(s) processada(s) com sucesso
                      {errorCount > 0 && `, ${errorCount} com erro`}
                    </p>
                  </div>
                </div>
              )}

              {/* File items */}
              <ScrollArea className={files.length > 5 ? "h-[320px]" : ""}>
                <div className="space-y-2">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        fileItem.status === "success"
                          ? "bg-emerald-50/50 border-emerald-200"
                          : fileItem.status === "error"
                            ? "bg-red-50/50 border-red-200"
                            : fileItem.status === "processing"
                              ? "bg-blue-50/50 border-blue-200"
                              : "bg-muted/30 border-border"
                      }`}
                    >
                      {/* Status Icon */}
                      <div className="shrink-0">
                        {fileItem.status === "processing" ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : fileItem.status === "success" ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : fileItem.status === "error" ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileItem.status === "processing"
                            ? (fileItem.file.name.toLowerCase().endsWith(".xml") ? "Extraindo XML..." : "Processando com IA...")
                            : fileItem.status === "success"
                              ? `NF ${fileItem.result?.invoiceNumber || "s/n"} — ${fileItem.result?.items?.length || 0} itens`
                              : fileItem.status === "error"
                                ? fileItem.error
                                : `${(fileItem.file.size / 1024 / 1024).toFixed(2)} MB`
                          }
                        </p>
                      </div>

                      {/* Source Badge for completed */}
                      {fileItem.status === "success" && (
                        fileItem.result?.extractedData?.source === "xml" ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 shrink-0">XML</Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 shrink-0">IA</Badge>
                        )
                      )}

                      {/* Value Badge for completed */}
                      {fileItem.status === "success" && fileItem.result?.totalValue && (
                        <Badge variant="secondary" className="font-mono shrink-0">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(fileItem.result.totalValue))}
                        </Badge>
                      )}

                      {/* Remove button (only for pending) */}
                      {fileItem.status === "pending" && !processing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeFile(fileItem.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {!processing && !allDone && pendingCount > 0 && (
                  <Button
                    onClick={processAllFiles}
                    className="flex-1 gap-2 h-12 text-base shadow-md hover:shadow-lg transition-all"
                    size="lg"
                  >
                    <Sparkles className="h-5 w-5" />
                    Processar {pendingCount} Nota{pendingCount > 1 ? "s" : ""} Fiscal{pendingCount > 1 ? "is" : ""}
                  </Button>
                )}

                {!processing && (allDone || (pendingCount === 0 && files.length > 0)) && (
                  <>
                    <Button onClick={resetForm} className="flex-1 gap-2">
                      <UploadIcon className="h-4 w-4" />
                      Processar Mais Notas
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/")} className="flex-1">
                      Voltar ao Dashboard
                    </Button>
                  </>
                )}

                {!processing && !allDone && pendingCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="shrink-0"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
