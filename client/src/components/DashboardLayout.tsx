import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import QuickSearchCommand from "./QuickSearchCommand";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Upload,
  Package,
  FileText,
  BarChart3,
  Users,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  CreditCard,
  HandCoins,
  Wallet,
  Boxes,
  ClipboardList,
  ShoppingCart,
  TrendingUp,
  Trophy,
  Gauge,
  Zap,
  Bell,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663173005738/hPrFgGbhTTKiLvuW.jpeg";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Upload, label: "Nova Movimentação", path: "/upload" },
  { icon: Package, label: "Estoque", path: "/estoque" },
  { icon: FileText, label: "Notas Fiscais", path: "/notas" },
  { icon: CreditCard, label: "Contas a Pagar", path: "/contas-pagar" },
  { icon: HandCoins, label: "Contas a Receber", path: "/contas-receber" },
  { icon: Wallet, label: "Caixa", path: "/caixa" },
  { icon: Boxes, label: "Insumos", path: "/insumos" },
  { icon: ClipboardList, label: "Ficha Técnica / Custos", path: "/ficha-tecnica" },
  { icon: ShoppingCart, label: "Vendas ABC", path: "/vendas-abc" },
  { icon: TrendingUp, label: "Curva ABC", path: "/curva-abc" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: Trophy, label: "Ranking", path: "/ranking" },
  { icon: Gauge, label: "Dashboard Executivo", path: "/dashboard-executivo" },
  { icon: Zap, label: "Integração Cometa", path: "/cometa-integracao" },
  { icon: Bell, label: "Monitoramento Cometa", path: "/cometa-monitoramento" },
  { icon: Users, label: "Fornecedores / Clientes", path: "/entidades" },
];

const adminMenuItems = [
  { icon: Shield, label: "Gestão de Usuários", path: "/admin/usuarios" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ─── Login Screen ────────────────────────────────────────
function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.localLogin.useMutation({
    onSuccess: () => {
      toast.success("Login realizado com sucesso!");
      // Force a full page reload to ensure the cookie is picked up
      // invalidate alone may not work if the cookie wasn't set yet
      setTimeout(() => {
        window.location.reload();
      }, 300);
    },
    onError: (err) => {
      toast.error(err.message || "Usuário ou senha incorretos.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Preencha o usuário e a senha.");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="w-full max-w-md px-4">
        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Header with logo */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 pt-10 pb-8 text-center">
            <img
              src={LOGO_URL}
              alt="Lustra Mil"
              className="h-20 w-20 rounded-2xl object-cover mx-auto shadow-lg border-2 border-white/20"
            />
            <h1 className="text-2xl font-bold text-white mt-4 tracking-tight">
              Lustra Mil
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Produtos de Limpeza — Controle de Estoque
            </p>
          </div>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Usuário
                </Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Digite seu usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold shadow-md hover:shadow-lg transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Acesso restrito a usuários autorizados.
              <br />
              Solicite suas credenciais ao administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Dashboard Layout Content ────────────────────────────
type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <QuickSearchCommand />
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="justify-center py-4">
            <div className="flex flex-col items-center gap-2 px-2 transition-all w-full">
              {!isCollapsed ? (
                <>
                  <img src={LOGO_URL} alt="Lustra Mil" className="h-16 w-16 rounded-xl object-cover shadow-md border-2 border-sidebar-accent/30" />
                  <span className="font-bold tracking-tight text-sidebar-foreground text-lg">
                    Lustra Mil
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/50 -mt-1 tracking-widest uppercase">Produtos de Limpeza</span>
                </>
              ) : (
                <img src={LOGO_URL} alt="Lustra Mil" className="h-8 w-8 rounded-md object-cover" />
              )}
              <button
                onClick={toggleSidebar}
                className="h-7 w-7 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 mt-1"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-3.5 w-3.5 text-sidebar-foreground/50" />
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {user?.role === "admin" && (
              <div className="px-2 pt-3 pb-1">
                <div className="border-t border-sidebar-border mb-2" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1 group-data-[collapsible=icon]:hidden">
                  Administração
                </p>
                <SidebarMenu>
                  {adminMenuItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-primary text-sidebar-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "Usuário"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                      {(user as any)?.username || user?.email || "—"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/alterar-senha")}
                  className="cursor-pointer"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Alterar Senha</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground font-semibold">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">
          {/* Print header - visible only when printing */}
          <div className="print-header">
            <img src={LOGO_URL} alt="Lustra Mil" />
            <div className="print-title">
              <h1>Lustra Mil</h1>
              <p>Produtos de Limpeza — {activeMenuItem?.label ?? ""}</p>
            </div>
          </div>
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
